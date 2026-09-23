create or replace function public.verify_community_member(
  p_community_id uuid,
  p_user_id uuid,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  membership public.community_members%rowtype;
  target_role_id uuid;
  tool_config jsonb := '{}'::jsonb;
  method_enabled boolean := true;
  role_name text;
  role_id_override text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  if p_method not in ('quick', 'picture', 'rules_gate', 'reaction-role') then
    return jsonb_build_object('success', false, 'error', 'Verification method is not enabled');
  end if;

  select coalesce(config, '{}'::jsonb)
    into tool_config
  from public.community_tool_settings
  where community_id = p_community_id and tool_type = 'verification';

  if p_method = 'quick' then
    method_enabled := coalesce((tool_config ->> 'quickEnabled')::boolean, true);
  elsif p_method = 'picture' then
    method_enabled := coalesce((tool_config ->> 'pictureEnabled')::boolean, true);
  elsif p_method = 'rules_gate' then
    method_enabled := coalesce((tool_config ->> 'rulesEnabled')::boolean, false)
      and coalesce((tool_config -> 'rules' ->> 'enabled')::boolean, false);
  end if;

  if not method_enabled then
    return jsonb_build_object('success', false, 'error', 'This verification method is disabled');
  end if;

  select * into membership
  from public.community_members
  where community_id = p_community_id and user_id = p_user_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Community membership not found');
  end if;

  role_name := coalesce(nullif(trim(tool_config -> 'roleGrant' ->> 'roleName'), ''), 'Verified');
  role_id_override := nullif(trim(tool_config -> 'roleGrant' ->> 'roleId'), '');

  if coalesce((tool_config -> 'roleGrant' ->> 'enabled')::boolean, false) then
    if role_id_override is not null then
      select id into target_role_id
      from public.community_roles
      where community_id = p_community_id and id = role_id_override::uuid
      limit 1;
    end if;

    if target_role_id is null then
      select id into target_role_id
      from public.community_roles
      where community_id = p_community_id and lower(name) = lower(role_name)
      limit 1;
    end if;

    if target_role_id is null then
      insert into public.community_roles (community_id, name, color, position, permissions, is_default)
      values (
        p_community_id,
        role_name,
        coalesce(tool_config ->> 'accentColor', '#84cc16'),
        99,
        jsonb_build_object(
          'sendMessages', true,
          'attachFiles', true,
          'embedLinks', true,
          'addReactions', true,
          'viewChannels', true,
          'readMessageHistory', true,
          'viewMembers', true,
          'changeOwnNickname', true,
          'useSlashCommands', true
        ),
        false
      ) returning id into target_role_id;
    end if;
  else
    select id into target_role_id
    from public.community_roles
    where community_id = p_community_id and lower(name) = 'member'
    limit 1;
  end if;

  if target_role_id is null then
    return jsonb_build_object('success', false, 'error', 'No target role is configured for verification');
  end if;

  update public.community_members
  set role_id = target_role_id
  where id = membership.id;

  return jsonb_build_object('success', true, 'role_id', target_role_id, 'method', p_method);
end;
$$;

revoke all on function public.verify_community_member(uuid, uuid, text) from public;
grant execute on function public.verify_community_member(uuid, uuid, text) to authenticated;
