create table if not exists public.pwa_install_reports (
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  first_reported_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  primary key (user_id, installation_id)
);

alter table public.pwa_install_reports enable row level security;

drop policy if exists pwa_install_reports_owner_select on public.pwa_install_reports;
create policy pwa_install_reports_owner_select on public.pwa_install_reports
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists pwa_install_reports_owner_insert on public.pwa_install_reports;
create policy pwa_install_reports_owner_insert on public.pwa_install_reports
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists pwa_install_reports_owner_update on public.pwa_install_reports;
create policy pwa_install_reports_owner_update on public.pwa_install_reports
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.pwa_install_reports to authenticated;
