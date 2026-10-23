create or replace function public.repair_community_owner_state(p_community_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  community_record record;
  owner_role_id uuid;
begin
  for community_record in
    select c.id, c.owner_id
    from public.communities c
    where (p_community_id is null or c.id = p_community_id)
      and c.owner_id is not null
  loop
    select cr.id into owner_role_id
    from public.community_roles cr
    where cr.community_id = community_record.id
      and lower(trim(cr.name)) = 'owner'
    order by cr.position asc, cr.created_at asc
    limit 1;

    if owner_role_id is null then
      insert into public.community_roles (community_id, name, color, position, permissions, is_default)
      values (
        community_record.id,
        'Owner',
        '#FFD700',
        0,
        jsonb_build_object(
          'sendMessages', true,
          'manageChannels', true,
          'manageMessages', true,
          'manageCommunity', true,
          'manageRoles', true,
          'administrator', true,
          'createChannels', true,
          'viewChannels', true,
          'viewMembers', true,
          'inviteMembers', true,
          'banMembers', true,
          'assignRoles', true,
          'manageInvites', true
        ),
        false
      ) returning id into owner_role_id;
    end if;

    insert into public.community_members (community_id, user_id, role_id, is_online, last_seen)
    values (community_record.id, community_record.owner_id, owner_role_id, true, now())
    on conflict (community_id, user_id) do update
      set role_id = excluded.role_id,
          is_online = true,
          last_seen = now();
  end loop;
end;
$$;

alter function public.repair_community_owner_state(uuid) owner to postgres;
revoke all on function public.repair_community_owner_state(uuid) from public;
grant execute on function public.repair_community_owner_state(uuid) to authenticated;

select public.repair_community_owner_state();

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
  community_owner_id uuid;
  current_role_name text;
  current_permissions jsonb;
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

  select owner_id
    into community_owner_id
  from public.communities
  where id = p_community_id;

  if community_owner_id = p_user_id then
    return jsonb_build_object(
      'success', true,
      'role_id', membership.role_id,
      'method', p_method,
      'preserved_role', true,
      'message', 'Community owner role preserved during verification.'
    );
  end if;

  select lower(trim(name)), permissions
    into current_role_name, current_permissions
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

  if current_role_name is not null and (
      current_role_name = 'owner'
      or coalesce(current_permissions, '{}'::jsonb) @> '{"administrator": true}'::jsonb
      or coalesce(current_permissions, '{}'::jsonb) @> '{"manageCommunity": true}'::jsonb
      or coalesce(current_permissions, '{}'::jsonb) @> '{"manageRoles": true}'::jsonb
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

revoke all on function public.verify_community_member(uuid, uuid, text) from public;
grant execute on function public.verify_community_member(uuid, uuid, text) to authenticated;
