-- Admin dashboard roster and assignment views need to read active admin members.
-- Team mutations remain restricted to manage_admin_member().

grant select on table public.admin_team to authenticated;

drop policy if exists admin_team_admin_roster_read on public.admin_team;
create policy admin_team_admin_roster_read on public.admin_team
for select to authenticated
using (
  status = 'active'
  and public.current_admin_role() is not null
);
