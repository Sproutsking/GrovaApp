-- Lock down admin-team writes so only the approved security-definer function can change admin roles.
-- This blocks self-promotion and keeps admin privileges server-controlled.

alter table public.admin_team enable row level security;

revoke all on table public.admin_team from anon;
revoke all on table public.admin_team from authenticated;

drop policy if exists admin_team_self_read on public.admin_team;
create policy admin_team_self_read on public.admin_team
for select to authenticated
using (
  user_id = auth.uid()
  or public.current_admin_role() in ('ceo_owner', 'super_admin')
);

drop policy if exists admin_team_no_direct_insert on public.admin_team;
create policy admin_team_no_direct_insert on public.admin_team
for insert to authenticated
with check (false);

drop policy if exists admin_team_restricted_update on public.admin_team;
create policy admin_team_restricted_update on public.admin_team
for update to authenticated
using (
  public.current_admin_role() in ('ceo_owner', 'super_admin')
)
with check (
  public.current_admin_role() in ('ceo_owner', 'super_admin')
);

-- Prevent anyone from escalating their own profile to admin via a client-side update.
-- The trusted admin authority is the `admin_team` table; `profiles` has no app-role column.
create or replace function public.ensure_admin_role_is_server_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and coalesce(new.is_admin, false) then
    raise exception 'Direct profile admin flags are not allowed. Admin membership is managed by server-side admin controls.';
  end if;

  if tg_op = 'UPDATE' and coalesce(new.is_admin, false) and new.is_admin <> coalesce(old.is_admin, false) then
    raise exception 'Direct profile admin flags are not allowed. Admin membership is managed by server-side admin controls.';
  end if;

  return new;
end;
$$;

drop trigger if exists profile_admin_guard on public.profiles;
create trigger profile_admin_guard
before insert or update on public.profiles
for each row execute function public.ensure_admin_role_is_server_only();

revoke all on function public.ensure_admin_role_is_server_only() from public;
grant execute on function public.ensure_admin_role_is_server_only() to service_role;