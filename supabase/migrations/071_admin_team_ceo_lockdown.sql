-- CEO-only admin authorization.
-- `public.profiles` does not store an app-role column; the admin authority is the `admin_team` table.
-- This blocks direct client-side authorization and ensures only the CEO can add, remove, or update admin roles.

alter table public.admin_team enable row level security;
revoke all on table public.admin_team from anon;
revoke all on table public.admin_team from authenticated;

-- Everyone can see only their own row; CEO can see all rows.
drop policy if exists admin_team_self_read on public.admin_team;
create policy admin_team_self_read on public.admin_team
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.admin_team caller
    where caller.user_id = auth.uid()
      and caller.status = 'active'
      and caller.role = 'ceo_owner'
  )
);

-- Only the CEO may create or update admin rows.
drop policy if exists admin_team_ceo_only_insert on public.admin_team;
create policy admin_team_ceo_only_insert on public.admin_team
for insert to authenticated
with check (
  exists (
    select 1
    from public.admin_team caller
    where caller.user_id = auth.uid()
      and caller.status = 'active'
      and caller.role = 'ceo_owner'
  )
);

drop policy if exists admin_team_ceo_only_update on public.admin_team;
create policy admin_team_ceo_only_update on public.admin_team
for update to authenticated
using (
  exists (
    select 1
    from public.admin_team caller
    where caller.user_id = auth.uid()
      and caller.status = 'active'
      and caller.role = 'ceo_owner'
  )
  and user_id <> auth.uid()
)
with check (
  exists (
    select 1
    from public.admin_team caller
    where caller.user_id = auth.uid()
      and caller.status = 'active'
      and caller.role = 'ceo_owner'
  )
  and user_id <> auth.uid()
);

drop policy if exists admin_team_ceo_only_delete on public.admin_team;
create policy admin_team_ceo_only_delete on public.admin_team
for delete to authenticated
using (
  exists (
    select 1
    from public.admin_team caller
    where caller.user_id = auth.uid()
      and caller.status = 'active'
      and caller.role = 'ceo_owner'
  )
  and user_id <> auth.uid()
);

-- Hard enforce the authority model: only the CEO may manage admin membership.
create or replace function public.manage_admin_member(
  p_action text,
  p_member_id uuid default null,
  p_user_id uuid default null,
  p_role text default null,
  p_permissions text[] default null
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

  if caller_role <> 'ceo_owner' then
    raise exception 'Only the CEO can manage admin access';
  end if;

  if p_action not in ('add', 'remove', 'restore', 'update') then
    raise exception 'Invalid admin action';
  end if;

  if p_action = 'add' then
    if p_user_id is null then
      raise exception 'User id is required';
    end if;

    if p_role is not null and p_role not in ('ceo_owner', 'super_admin', 'a_admin', 'b_admin', 'admin', 'support') then
      raise exception 'Invalid admin role';
    end if;

    insert into public.admin_team(user_id, email, full_name, role, permissions, status, created_at)
    select p.id, p.email, p.full_name, coalesce(p_role, 'support'), coalesce(p_permissions, ARRAY[]::text[]), 'active', now()
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

  select * into target
  from public.admin_team
  where id = p_member_id
  for update;

  if target.id is null then
    raise exception 'Admin member not found';
  end if;

  if target.user_id = auth.uid() and p_action in ('remove', 'update') then
    raise exception 'You cannot remove or demote your own active admin account';
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

revoke all on function public.manage_admin_member(text, uuid, uuid, text, text[]) from public;
grant execute on function public.manage_admin_member(text, uuid, uuid, text, text[]) to authenticated;
