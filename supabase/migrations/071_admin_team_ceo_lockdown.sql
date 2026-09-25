-- Lock down admin_team direct writes so only the CEO can alter the CEO row,
-- and only the server-side management function can perform role changes.

-- 1) Replace the overly broad direct-update policy.
drop policy if exists admin_team_restricted_update on public.admin_team;
create policy admin_team_restricted_update on public.admin_team
for update to authenticated
using (
  exists (
    select 1
    from public.admin_team caller
    where caller.user_id = auth.uid()
      and caller.status = 'active'
      and caller.role in ('ceo_owner', 'super_admin')
  )
  and admin_team.user_id <> auth.uid()
  and not (
    admin_team.role = 'ceo_owner'
    and not exists (
      select 1
      from public.admin_team caller
      where caller.user_id = auth.uid()
        and caller.status = 'active'
        and caller.role = 'ceo_owner'
    )
  )
)
with check (
  exists (
    select 1
    from public.admin_team caller
    where caller.user_id = auth.uid()
      and caller.status = 'active'
      and caller.role in ('ceo_owner', 'super_admin')
  )
  and admin_team.user_id <> auth.uid()
  and not (
    (coalesce(new.role, admin_team.role) = 'ceo_owner' or coalesce(old.role, admin_team.role) = 'ceo_owner')
    and not exists (
      select 1
      from public.admin_team caller
      where caller.user_id = auth.uid()
        and caller.status = 'active'
        and caller.role = 'ceo_owner'
    )
  )
);

-- 2) Prevent direct role edits by blocking code paths that mutate role/status fields without the server guard.
drop trigger if exists profile_admin_guard on public.profiles;
create trigger profile_admin_guard
before insert or update on public.profiles
for each row execute function public.ensure_admin_role_is_server_only();

-- 3) Re-assert the function-level protection explicitly for role changes.
create or replace function public.manage_admin_member(
  p_action text,
  p_member_id uuid default null,
  p_user_id uuid default null,
  p_role text default null,
  p_permissions jsonb default null
)
returns public.admin_team
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_admin_role();
  target public.admin_team;
begin
  if caller_role is null then
    raise exception 'Unauthorized';
  end if;

  if p_action not in ('add', 'remove', 'restore', 'update') then
    raise exception 'Invalid admin action';
  end if;

  if p_action = 'add' then
    if caller_role not in ('ceo_owner', 'super_admin') or p_user_id is null then
      raise exception 'Not permitted';
    end if;
    if p_role = 'ceo_owner' and caller_role <> 'ceo_owner' then
      raise exception 'Only the CEO can create a CEO admin';
    end if;
    insert into public.admin_team(user_id, email, full_name, role, permissions, status, created_at)
    select p.id, p.email, p.full_name, coalesce(p_role, 'support'), coalesce(p_permissions, '[]'::jsonb), 'active', now()
    from public.profiles p
    where p.id = p_user_id
    on conflict (user_id) do update set
      role = excluded.role,
      permissions = excluded.permissions,
      status = 'active',
      full_name = excluded.full_name,
      email = excluded.email
    returning * into target;
    if target.id is null then
      raise exception 'User profile not found';
    end if;
    return target;
  end if;

  select * into target from public.admin_team where id = p_member_id for update;
  if target.id is null then
    raise exception 'Admin member not found';
  end if;

  if target.user_id = auth.uid() and p_action in ('remove', 'update') then
    raise exception 'You cannot remove or demote your own active admin account';
  end if;

  if target.role = 'ceo_owner' and caller_role <> 'ceo_owner' then
    raise exception 'Only the CEO can manage the CEO account';
  end if;

  if p_role is not null and p_role not in ('ceo_owner', 'super_admin', 'a_admin', 'b_admin', 'admin', 'support') then
    raise exception 'Invalid admin role';
  end if;

  if p_role = 'ceo_owner' and caller_role <> 'ceo_owner' then
    raise exception 'Only the CEO can promote a CEO admin';
  end if;

  if caller_role <> 'ceo_owner' and target.role in ('super_admin', 'ceo_owner') then
    raise exception 'Only the CEO can manage senior admins';
  end if;

  if p_action = 'remove' then
    update public.admin_team
    set status = 'inactive'
    where id = target.id
    returning * into target;
  elsif p_action = 'restore' then
    update public.admin_team
    set status = 'active'
    where id = target.id
    returning * into target;
  else
    update public.admin_team
    set role = coalesce(p_role, role), permissions = coalesce(p_permissions, permissions)
    where id = target.id
    returning * into target;
  end if;

  return target;
end;
$$;

revoke all on function public.manage_admin_member(text, uuid, uuid, text, jsonb) from public;
grant execute on function public.manage_admin_member(text, uuid, uuid, text, jsonb) to authenticated;
