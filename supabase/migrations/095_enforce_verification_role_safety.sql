create or replace function public.complete_community_verification(
  p_community_id uuid,
  p_method text,
  p_answer text default null,
  p_accepted boolean default false,
  p_role_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_row public.community_tool_settings;
  method_key text;
  method_config jsonb;
  rules_gate jsonb;
  rules_flow text;
  role_grant jsonb;
  allowed_role_ids jsonb;
  selected_role_id uuid;
  target_role public.community_roles;
  default_role_position integer;
begin
  method_key := case p_method when 'rules_gate' then 'rules' else p_method end;
  select * into settings_row
  from public.community_tool_settings
  where community_id = p_community_id and tool_type = 'verification';

  rules_gate := coalesce(settings_row.config -> 'rulesGate', '{}'::jsonb);
  rules_flow := coalesce(rules_gate ->> 'flow', 'rules_only');
  if p_method in ('rules', 'rules_gate')
    and coalesce((rules_gate ->> 'enabled')::boolean, false)
    and rules_flow = 'rules_then_verify'
    and rules_gate ->> 'secondMethod' = 'reaction' then
    if auth.uid() is null then
      return jsonb_build_object('success', false, 'error', 'Unauthorized');
    end if;
    if not coalesce(settings_row.enabled, false)
      or not coalesce((settings_row.config -> 'methods' -> 'rules' ->> 'enabled')::boolean, false)
      or nullif(rules_gate ->> 'rulesChannelId', '') is null
      or nullif(rules_gate ->> 'verificationChannelId', '') is null
      or rules_gate ->> 'rulesChannelId' = rules_gate ->> 'verificationChannelId' then
      return jsonb_build_object('success', false, 'error', 'The community rules gate is not configured correctly');
    end if;
    if not exists (
      select 1 from public.community_members
      where community_id = p_community_id and user_id = auth.uid()
    ) then
      return jsonb_build_object('success', false, 'error', 'Community membership not found');
    end if;
    if not coalesce(p_accepted, false) then
      return jsonb_build_object('success', false, 'error', 'You must accept the rules before continuing');
    end if;
    if exists (
      select 1 from public.communities
      where id = p_community_id and owner_id = auth.uid()
    ) then
      return jsonb_build_object('success', true, 'preserved_role', true, 'message', 'Community owner role preserved');
    end if;
    insert into public.community_verification_completions (community_id, user_id, method, role_id, status)
    values (p_community_id, auth.uid(), 'rules', null, 'rules_accepted')
    on conflict (community_id, user_id, method) do update
      set role_id = null, status = 'rules_accepted', completed_at = now();
    return jsonb_build_object('success', true, 'rules_accepted', true, 'method', 'rules');
  end if;

  if coalesce(settings_row.enabled, false)
    and method_key in ('rules', 'quick', 'picture') then
    method_config := settings_row.config -> 'methods' -> method_key;
    role_grant := coalesce(settings_row.config -> 'roleGrant', '{}'::jsonb);
    allowed_role_ids := coalesce(role_grant -> 'roleIds', '[]'::jsonb);
    if not coalesce((role_grant ->> 'enabled')::boolean, false) then
      allowed_role_ids := '[]'::jsonb;
    end if;
    if jsonb_typeof(allowed_role_ids) <> 'array' then
      allowed_role_ids := '[]'::jsonb;
    end if;
    if jsonb_array_length(allowed_role_ids) = 0 then
      if nullif(method_config ->> 'roleId', '') is not null then
        allowed_role_ids := jsonb_build_array(method_config ->> 'roleId');
      elsif nullif(role_grant ->> 'roleId', '') is not null then
        allowed_role_ids := jsonb_build_array(role_grant ->> 'roleId');
      else
        select id into selected_role_id
        from public.community_roles
        where community_id = p_community_id and lower(trim(name)) = 'member'
        order by position asc limit 1;
        if selected_role_id is not null then
          allowed_role_ids := jsonb_build_array(selected_role_id::text);
        end if;
      end if;
    end if;

    selected_role_id := p_role_id;
    if selected_role_id is null
      and jsonb_array_length(allowed_role_ids) = 1
      and not coalesce((role_grant ->> 'enabled')::boolean, false) then
      selected_role_id := (allowed_role_ids ->> 0)::uuid;
    end if;

    if selected_role_id is not null then
      if not (allowed_role_ids @> jsonb_build_array(selected_role_id::text)) then
        return jsonb_build_object('success', false, 'error', 'Choose one of the roles configured by the community owner');
      end if;
      select * into target_role
      from public.community_roles
      where id = selected_role_id and community_id = p_community_id;
      if not found then
        return jsonb_build_object('success', false, 'error', 'The selected role is no longer available');
      end if;
      if target_role.is_default or lower(trim(target_role.name)) = 'owner'
        or coalesce((target_role.permissions ->> 'administrator')::boolean, false)
        or coalesce((target_role.permissions ->> 'manageRoles')::boolean, false)
        or coalesce((target_role.permissions ->> 'assignRoles')::boolean, false)
        or coalesce((target_role.permissions ->> 'manageCommunity')::boolean, false)
        or coalesce((target_role.permissions ->> 'manageChannels')::boolean, false)
        or coalesce((target_role.permissions ->> 'kickMembers')::boolean, false)
        or coalesce((target_role.permissions ->> 'banMembers')::boolean, false)
        or coalesce((target_role.permissions ->> 'manageMessages')::boolean, false)
        or coalesce((target_role.permissions ->> 'timeoutMembers')::boolean, false) then
        return jsonb_build_object('success', false, 'error', 'This role cannot be granted through verification');
      end if;
      select position into default_role_position
      from public.community_roles
      where community_id = p_community_id and is_default = true
      order by position asc limit 1;
      if default_role_position is not null and target_role.position >= default_role_position then
        return jsonb_build_object('success', false, 'error', 'Place selectable verification roles above the default member role in the role hierarchy');
      end if;
    end if;
  end if;

  return public.complete_community_verification_legacy(
    p_community_id, p_method, p_answer, p_accepted, p_role_id
  );
end;
$$;

alter function public.complete_community_verification(uuid, text, text, boolean, uuid) owner to postgres;
revoke all on function public.complete_community_verification(uuid, text, text, boolean, uuid) from public;
grant execute on function public.complete_community_verification(uuid, text, text, boolean, uuid) to authenticated;