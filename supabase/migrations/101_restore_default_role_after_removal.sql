create or replace function public.remove_community_member_role(
  p_community_id uuid,
  p_user_id uuid,
  p_role_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  owner_id uuid;
  target_role public.community_roles;
  actor_role public.community_roles;
  actor_role_id uuid;
  effective_role_id uuid;
  default_role_id uuid;
  membership_id uuid;
  legacy_role_id uuid;
begin
  if actor_id is null then raise exception 'Unauthorized'; end if;
  select c.owner_id into owner_id from public.communities c where c.id = p_community_id;
  if not found then raise exception 'Community not found'; end if;
  select * into target_role
  from public.community_roles
  where id = p_role_id and community_id = p_community_id;
  if not found then raise exception 'Role not found'; end if;
  select id, role_id into membership_id, legacy_role_id
  from public.community_members
  where community_id = p_community_id and user_id = p_user_id
  for update;
  if membership_id is null then
    raise exception 'Community member not found';
  end if;
  if p_user_id = owner_id or target_role.is_default or lower(trim(target_role.name)) = 'owner' then
    raise exception 'This role assignment is protected';
  end if;
  if not exists (
    select 1
    from public.community_member_roles
    where community_id = p_community_id
      and user_id = p_user_id
      and role_id = p_role_id
  ) and legacy_role_id is distinct from p_role_id then
    raise exception 'This role is not assigned to the member';
  end if;
  if actor_id <> owner_id then
    actor_role_id := public.get_effective_community_role_id(p_community_id, actor_id);
    select * into actor_role from public.community_roles where id = actor_role_id;
    if actor_role_id is null
      or not (
        coalesce((actor_role.permissions ->> 'assignRoles')::boolean, false)
        or coalesce((actor_role.permissions ->> 'manageRoles')::boolean, false)
        or coalesce((actor_role.permissions ->> 'administrator')::boolean, false)
      )
      or (
        not coalesce((actor_role.permissions ->> 'administrator')::boolean, false)
        and actor_role.position >= target_role.position
      ) then
      raise exception 'You do not have permission to remove this role';
    end if;
  end if;

  if not exists (
    select 1
    from public.community_member_roles
    where community_id = p_community_id
      and user_id = p_user_id
      and role_id <> p_role_id
  ) then
    select id into default_role_id
    from public.community_roles
    where community_id = p_community_id
      and is_default
      and id <> p_role_id
    order by position asc, created_at asc, id asc
    limit 1;
    if default_role_id is null then
      default_role_id := public.ensure_default_community_role(p_community_id);
    end if;
    insert into public.community_member_roles (community_id, user_id, role_id)
    values (p_community_id, p_user_id, default_role_id)
    on conflict (community_id, user_id, role_id) do nothing;
  end if;

  delete from public.community_member_roles
  where community_id = p_community_id and user_id = p_user_id and role_id = p_role_id;

  effective_role_id := public.get_effective_community_role_id(p_community_id, p_user_id);
  if effective_role_id is null then
    raise exception 'Role removal did not leave the member with an effective role';
  end if;
  update public.community_members
  set role_id = effective_role_id
  where community_id = p_community_id and user_id = p_user_id;
  return jsonb_build_object('success', true, 'effective_role_id', effective_role_id);
end;
$$;

alter function public.remove_community_member_role(uuid, uuid, uuid) owner to postgres;
revoke all on function public.remove_community_member_role(uuid, uuid, uuid) from public;
grant execute on function public.remove_community_member_role(uuid, uuid, uuid) to authenticated;
