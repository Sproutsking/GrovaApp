-- Tighten DB-level access for evidence metadata and keep public visibility to verified, non-sensitive records only.
-- This preserves the expected evidence/verification UX while removing blanket public reads.

revoke all on table public.evidence_items from anon;
revoke all on table public.evidence_edges from anon;

alter table public.evidence_items enable row level security;
alter table public.evidence_edges enable row level security;

drop policy if exists "Public can read evidence items by profile" on public.evidence_items;
create policy "Authenticated users can read own or verified evidence" on public.evidence_items
  for select to authenticated
  using (
    auth.role() = 'service_role'
    or profile_id = auth.uid()
    or (verified = true and profile_id is not null)
  );

drop policy if exists "Service role may modify evidence items" on public.evidence_items;
create policy "Service role may modify evidence items" on public.evidence_items
  for all to service_role
  using (true)
  with check (true);

-- Keep edges visible only when the connected items are already permitted to be seen.
drop policy if exists "Public can read evidence edges" on public.evidence_edges;
create policy "Authenticated users can read relevant evidence edges" on public.evidence_edges
  for select to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.evidence_items src
      where src.id = evidence_edges.source_id
        and (src.profile_id = auth.uid() or src.verified = true)
    )
    or exists (
      select 1 from public.evidence_items tgt
      where tgt.id = evidence_edges.target_id
        and (tgt.profile_id = auth.uid() or tgt.verified = true)
    )
  );

drop policy if exists "Service role may modify evidence edges" on public.evidence_edges;
create policy "Service role may modify evidence edges" on public.evidence_edges
  for all to service_role
  using (true)
  with check (true);

-- Harden the admin-sensitive security alerts table: no anonymous access and explicit admin-only visibility.
revoke all on table public.security_alerts from anon;
revoke all on table public.security_alert_viewers from anon;

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.admin_team
  where user_id = auth.uid() and status = 'active'
  limit 1
$$;

-- Preserve existing admin policies but ensure the default path is least-privileged.
drop policy if exists security_alerts_read on public.security_alerts;
create policy security_alerts_read on public.security_alerts
  for select to authenticated
  using (
    public.current_admin_role() = 'ceo_owner'
    or exists (
      select 1 from public.security_alert_viewers v
      where v.alert_id = security_alerts.id and v.admin_user_id = auth.uid()
    )
  );

drop policy if exists security_alert_viewers_read on public.security_alert_viewers;
create policy security_alert_viewers_read on public.security_alert_viewers
  for select to authenticated
  using (
    public.current_admin_role() = 'ceo_owner'
    or admin_user_id = auth.uid()
  );
