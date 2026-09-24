-- Preserve privileged roles when a verification flow grants a new role.
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
  current_role public.community_roles%rowtype;
  target_role_id uuid;
  role_name text;
  role_id_override text;
  tool_config jsonb := '{}'::jsonb;
  method_enabled boolean := true;
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

  select *
    into membership
  from public.community_members
  where community_id = p_community_id and user_id = p_user_id
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Community membership not found');
  end if;

  select *
    into current_role
  from public.community_roles
  where id = membership.role_id
  limit 1;

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

  if current_role.name is not null and (
      lower(trim(current_role.name)) = 'owner'
      or current_role.permissions @> '{"administrator": true}'::jsonb
      or current_role.permissions @> '{"manageCommunity": true}'::jsonb
      or current_role.permissions @> '{"manageRoles": true}'::jsonb
    ) then
    return jsonb_build_object(
      'success', true,
      'role_id', membership.role_id,
      'method', p_method,
      'preserved_role', true,
      'message', 'Owner or privileged role preserved during verification.'
    );
  end if;

  update public.community_members
  set role_id = target_role_id,
      last_seen = now()
  where id = membership.id;

  return jsonb_build_object('success', true, 'role_id', target_role_id, 'method', p_method, 'preserved_role', false);
end;
$$;

create or replace function public.complete_community_verification(
  p_community_id uuid,
  p_method text,
  p_answer text default null,
  p_accepted boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tool_config jsonb;
  expected_answer text;
  enabled boolean;
  result jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  select coalesce(config, '{}'::jsonb) into tool_config
  from public.community_tool_settings
  where community_id = p_community_id and tool_type = 'verification';

  if p_method = 'quick' then
    enabled := coalesce((tool_config ->> 'quickEnabled')::boolean, true);
  elsif p_method = 'picture' then
    enabled := coalesce((tool_config ->> 'pictureEnabled')::boolean, true);
    expected_answer := trim(coalesce(tool_config -> 'picture' ->> 'correctAnswer', ''));
    if enabled and expected_answer <> '' and lower(trim(coalesce(p_answer, ''))) <> lower(expected_answer) then
      return jsonb_build_object('success', false, 'error', 'Picture challenge answer is incorrect.');
    end if;
  elsif p_method = 'rules_gate' then
    enabled := coalesce((tool_config ->> 'rulesEnabled')::boolean, false)
      and coalesce((tool_config -> 'rules' ->> 'enabled')::boolean, false);
    if enabled and not coalesce(p_accepted, false) then
      return jsonb_build_object('success', false, 'error', 'You must accept the rules before continuing.');
    end if;
  elsif p_method = 'reaction-role' then
    enabled := true;
    expected_answer := trim(coalesce(tool_config -> 'reactionRole' ->> 'correctAnswer', ''));
    if enabled and expected_answer <> '' and lower(trim(coalesce(p_answer, ''))) <> lower(expected_answer) then
      return jsonb_build_object('success', false, 'error', 'That reaction choice is not the correct answer.');
    end if;
  else
    return jsonb_build_object('success', false, 'error', 'Verification method is not enabled');
  end if;

  if not enabled then
    return jsonb_build_object('success', false, 'error', 'This verification method is disabled');
  end if;

  select verify_community_member(p_community_id, auth.uid(), p_method) into result;
  return result;
end;
$$;

revoke all on function public.verify_community_member(uuid, uuid, text) from public;
grant execute on function public.verify_community_member(uuid, uuid, text) to authenticated;
revoke all on function public.complete_community_verification(uuid, text, text, boolean) from public;
grant execute on function public.complete_community_verification(uuid, text, text, boolean) to authenticated;
