create or replace function public.ensure_default_community_role(p_community_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id uuid;
  default_position integer;
begin
  perform 1
  from public.communities
  where id = p_community_id
  for update;
  if not found then
    raise exception 'Community not found';
  end if;

  select id
  into default_role_id
  from public.community_roles
  where community_id = p_community_id
    and (is_default or lower(trim(name)) in ('novis', 'novice'))
  order by is_default desc,
    (lower(trim(name)) = 'novice') desc,
    position asc,
    created_at asc,
    id asc
  limit 1
  for update;

  if default_role_id is null then
    select coalesce(max(position), -1) + 1
    into default_position
    from public.community_roles
    where community_id = p_community_id;

    insert into public.community_roles (community_id, name, color, position, permissions, is_default)
    values (
      p_community_id,
      'Novice',
      '#95A5A6',
      default_position,
      jsonb_build_object('viewChannels', true, 'addReactions', true),
      true
    )
    returning id into default_role_id;
  else
    select coalesce(max(position), -1) + 1
    into default_position
    from public.community_roles
    where community_id = p_community_id
      and id <> default_role_id;

    update public.community_roles
    set name = 'Novice',
        is_default = true,
        position = default_position,
        updated_at = now()
    where id = default_role_id;
  end if;

  return default_role_id;
end;
$$;

alter function public.ensure_default_community_role(uuid) owner to postgres;
revoke all on function public.ensure_default_community_role(uuid) from public;

create or replace function public.enforce_community_novice_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_default or lower(trim(new.name)) in ('novis', 'novice') then
    new.name := 'Novice';
    new.is_default := true;
    new.permissions := coalesce(new.permissions, '{}'::jsonb) || jsonb_build_object(
      'administrator', false,
      'manageRoles', false,
      'assignRoles', false,
      'manageCommunity', false,
      'manageChannels', false,
      'createChannels', false,
      'inviteMembers', false,
      'kickMembers', false,
      'banMembers', false,
      'manageMessages', false,
      'timeoutMembers', false
    );
  end if;
  return new;
end;
$$;

alter function public.enforce_community_novice_role() owner to postgres;
drop trigger if exists community_roles_enforce_novice_safety on public.community_roles;
create trigger community_roles_enforce_novice_safety
  before insert or update on public.community_roles
  for each row execute function public.enforce_community_novice_role();

do $$
declare
  community_row record;
  duplicate_role record;
  default_role_id uuid;
  owner_role_id uuid;
begin
  for community_row in
    select id, owner_id from public.communities
  loop
    default_role_id := public.ensure_default_community_role(community_row.id);

    select id into owner_role_id
    from public.community_roles
    where community_id = community_row.id
      and lower(trim(name)) = 'owner'
    order by position asc, created_at asc, id asc
    limit 1
    for update;

    if owner_role_id is null and community_row.owner_id is not null then
      insert into public.community_roles (community_id, name, color, position, permissions, is_default)
      values (
        community_row.id,
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
      )
      returning id into owner_role_id;
    end if;

    for duplicate_role in
      select id
      from public.community_roles
      where community_id = community_row.id
        and (is_default or lower(trim(name)) in ('novis', 'novice'))
        and id <> default_role_id
    loop
      insert into public.community_member_roles (community_id, user_id, role_id, assigned_by, assigned_at)
      select community_id, user_id, default_role_id, assigned_by, assigned_at
      from public.community_member_roles
      where community_id = community_row.id and role_id = duplicate_role.id
      on conflict (community_id, user_id, role_id) do nothing;

      insert into public.community_access_rules (community_id, target_type, target_id, role_id, can_view, can_send, updated_at)
      select community_id, target_type, target_id, default_role_id, can_view, can_send, updated_at
      from public.community_access_rules
      where community_id = community_row.id and role_id = duplicate_role.id
      on conflict (target_type, target_id, role_id) do update
      set can_view = community_access_rules.can_view and excluded.can_view,
          can_send = community_access_rules.can_send and excluded.can_send,
          updated_at = greatest(community_access_rules.updated_at, excluded.updated_at);

      insert into public.channel_permission_overrides (community_id, channel_id, role_id, permission, state, created_at, updated_at)
      select community_id, channel_id, default_role_id, permission, state, created_at, updated_at
      from public.channel_permission_overrides
      where community_id = community_row.id and role_id = duplicate_role.id
      on conflict (channel_id, role_id, permission) do update
      set state = case
            when channel_permission_overrides.state = 'deny' or excluded.state = 'deny' then 'deny'
            else 'allow'
          end,
          updated_at = greatest(channel_permission_overrides.updated_at, excluded.updated_at);

      insert into public.category_permission_overrides (community_id, category_id, role_id, permission, state, apply_to_channels, created_at, updated_at)
      select community_id, category_id, default_role_id, permission, state, apply_to_channels, created_at, updated_at
      from public.category_permission_overrides
      where community_id = community_row.id and role_id = duplicate_role.id
      on conflict (category_id, role_id, permission) do update
      set state = case
            when category_permission_overrides.state = 'deny' or excluded.state = 'deny' then 'deny'
            else 'allow'
          end,
          apply_to_channels = case
            when category_permission_overrides.state = 'deny' or excluded.state = 'deny'
              then category_permission_overrides.apply_to_channels or excluded.apply_to_channels
            else category_permission_overrides.apply_to_channels and excluded.apply_to_channels
          end,
          updated_at = greatest(category_permission_overrides.updated_at, excluded.updated_at);

      update public.community_members
      set role_id = default_role_id
      where community_id = community_row.id and role_id = duplicate_role.id;

      delete from public.community_member_roles
      where community_id = community_row.id and role_id = duplicate_role.id;
      delete from public.community_access_rules
      where community_id = community_row.id and role_id = duplicate_role.id;
      delete from public.channel_permission_overrides
      where community_id = community_row.id and role_id = duplicate_role.id;
      delete from public.category_permission_overrides
      where community_id = community_row.id and role_id = duplicate_role.id;
      delete from public.community_roles where id = duplicate_role.id;
    end loop;

    if owner_role_id is not null then
      for duplicate_role in
        select id
        from public.community_roles
        where community_id = community_row.id
          and lower(trim(name)) = 'owner'
          and id <> owner_role_id
      loop
        insert into public.community_member_roles (community_id, user_id, role_id, assigned_by, assigned_at)
        select community_id, user_id, owner_role_id, assigned_by, assigned_at
        from public.community_member_roles
        where community_id = community_row.id and role_id = duplicate_role.id
        on conflict (community_id, user_id, role_id) do nothing;

        insert into public.community_access_rules (community_id, target_type, target_id, role_id, can_view, can_send, updated_at)
        select community_id, target_type, target_id, owner_role_id, can_view, can_send, updated_at
        from public.community_access_rules
        where community_id = community_row.id and role_id = duplicate_role.id
        on conflict (target_type, target_id, role_id) do update
        set can_view = community_access_rules.can_view and excluded.can_view,
            can_send = community_access_rules.can_send and excluded.can_send,
            updated_at = greatest(community_access_rules.updated_at, excluded.updated_at);

        insert into public.channel_permission_overrides (community_id, channel_id, role_id, permission, state, created_at, updated_at)
        select community_id, channel_id, owner_role_id, permission, state, created_at, updated_at
        from public.channel_permission_overrides
        where community_id = community_row.id and role_id = duplicate_role.id
        on conflict (channel_id, role_id, permission) do update
        set state = case
              when channel_permission_overrides.state = 'deny' or excluded.state = 'deny' then 'deny'
              else 'allow'
            end,
            updated_at = greatest(channel_permission_overrides.updated_at, excluded.updated_at);

        insert into public.category_permission_overrides (community_id, category_id, role_id, permission, state, apply_to_channels, created_at, updated_at)
        select community_id, category_id, owner_role_id, permission, state, apply_to_channels, created_at, updated_at
        from public.category_permission_overrides
        where community_id = community_row.id and role_id = duplicate_role.id
        on conflict (category_id, role_id, permission) do update
        set state = case
              when category_permission_overrides.state = 'deny' or excluded.state = 'deny' then 'deny'
              else 'allow'
            end,
            apply_to_channels = case
              when category_permission_overrides.state = 'deny' or excluded.state = 'deny'
                then category_permission_overrides.apply_to_channels or excluded.apply_to_channels
              else category_permission_overrides.apply_to_channels and excluded.apply_to_channels
            end,
            updated_at = greatest(category_permission_overrides.updated_at, excluded.updated_at);

        update public.community_members
        set role_id = owner_role_id
        where community_id = community_row.id and role_id = duplicate_role.id;

        delete from public.community_member_roles
        where community_id = community_row.id and role_id = duplicate_role.id;
        delete from public.community_access_rules
        where community_id = community_row.id and role_id = duplicate_role.id;
        delete from public.channel_permission_overrides
        where community_id = community_row.id and role_id = duplicate_role.id;
        delete from public.category_permission_overrides
        where community_id = community_row.id and role_id = duplicate_role.id;
        delete from public.community_roles where id = duplicate_role.id;
      end loop;

      if community_row.owner_id is not null then
        insert into public.community_member_roles (community_id, user_id, role_id)
        values (community_row.id, community_row.owner_id, owner_role_id)
        on conflict (community_id, user_id, role_id) do nothing;
      end if;
    end if;

    insert into public.community_member_roles (community_id, user_id, role_id, assigned_at)
    select community_id, user_id, default_role_id, coalesce(joined_at, now())
    from public.community_members
    where community_id = community_row.id
    on conflict (community_id, user_id, role_id) do nothing;

    update public.community_members member
    set role_id = public.get_effective_community_role_id(member.community_id, member.user_id)
    where member.community_id = community_row.id
      and member.role_id is distinct from public.get_effective_community_role_id(member.community_id, member.user_id);
  end loop;
end;
$$;

create unique index if not exists community_roles_one_default_per_community
  on public.community_roles (community_id)
  where is_default;

create unique index if not exists community_roles_reserved_identity_per_community
  on public.community_roles (community_id, lower(trim(name)))
  where lower(trim(name)) in ('owner', 'novice', 'novis');
