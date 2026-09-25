-- Security center and server-enforced admin lifecycle controls.
-- The browser is never trusted for admin authorization or alert visibility.

alter table public.security_events
  add column if not exists resolved boolean not null default false,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id);

create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  description text not null default '',
  source text not null default 'system',
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create table if not exists public.security_alert_viewers (
  alert_id uuid not null references public.security_alerts(id) on delete cascade,
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (alert_id, admin_user_id)
);

create index if not exists security_alerts_status_created_idx
  on public.security_alerts(status, created_at desc);
create index if not exists security_alert_viewers_admin_idx
  on public.security_alert_viewers(admin_user_id, alert_id);

create or replace function public.mirror_security_event_to_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.severity in ('warning', 'critical') then
    insert into public.security_alerts(event_type, severity, title, description, source, metadata)
    values (
      new.event_type,
      new.severity,
      'Security event detected: ' || new.event_type,
      'A security-sensitive event was recorded and requires review.',
      'security_events',
      coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object('security_event_id', new.id, 'ip_address', new.ip_address)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists security_event_alert_mirror on public.security_events;
create trigger security_event_alert_mirror
  after insert on public.security_events
  for each row execute function public.mirror_security_event_to_alert();

alter table public.security_alerts enable row level security;
alter table public.security_alert_viewers enable row level security;

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

revoke all on function public.current_admin_role() from public;
grant execute on function public.current_admin_role() to authenticated;

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

create or replace function public.create_security_alert(
  p_event_type text,
  p_severity text,
  p_title text,
  p_description text default '',
  p_source text default 'system',
  p_metadata jsonb default '{}'::jsonb,
  p_viewer_ids uuid[] default null
)
returns public.security_alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  new_alert public.security_alerts;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_severity not in ('info', 'warning', 'critical') then raise exception 'Invalid alert severity'; end if;
  if public.current_admin_role() not in ('ceo_owner', 'super_admin') then
    raise exception 'Only senior admins can create security alerts';
  end if;

  insert into public.security_alerts(event_type, severity, title, description, source, metadata)
  values (left(trim(p_event_type), 120), p_severity, left(trim(p_title), 180), left(coalesce(p_description, ''), 4000), left(trim(p_source), 80), coalesce(p_metadata, '{}'::jsonb))
  returning * into new_alert;

  if p_viewer_ids is not null then
    insert into public.security_alert_viewers(alert_id, admin_user_id)
    select new_alert.id, p.id
    from public.admin_team p
    where p.user_id = any(p_viewer_ids) and p.status = 'active'
    on conflict do nothing;
  end if;
  return new_alert;
end;
$$;

create or replace function public.set_security_alert_viewers(p_alert_id uuid, p_viewer_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_admin_role() not in ('ceo_owner', 'super_admin') then raise exception 'Only senior admins can manage alert visibility'; end if;
  delete from public.security_alert_viewers where alert_id = p_alert_id;
  insert into public.security_alert_viewers(alert_id, admin_user_id)
  select p_alert_id, p.id from public.admin_team p
  where p.user_id = any(coalesce(p_viewer_ids, '{}'::uuid[])) and p.status = 'active'
  on conflict do nothing;
end;
$$;

create or replace function public.update_security_alert_status(p_alert_id uuid, p_status text)
returns public.security_alerts
language plpgsql
security definer
set search_path = public
as $$
declare updated_alert public.security_alerts;
begin
  if public.current_admin_role() is null then raise exception 'Unauthorized'; end if;
  if p_status not in ('acknowledged', 'resolved') then raise exception 'Invalid alert status'; end if;
  if not exists (
    select 1 from public.security_alerts a
    where a.id = p_alert_id
      and (public.current_admin_role() = 'ceo_owner' or exists (select 1 from public.security_alert_viewers v where v.alert_id = a.id and v.admin_user_id = auth.uid()))
  ) then raise exception 'Alert is not visible to this admin'; end if;

  update public.security_alerts
  set status = p_status,
      acknowledged_at = case when p_status = 'acknowledged' then coalesce(acknowledged_at, now()) else acknowledged_at end,
      acknowledged_by = case when p_status = 'acknowledged' then coalesce(acknowledged_by, auth.uid()) else acknowledged_by end,
      resolved_at = case when p_status = 'resolved' then now() else resolved_at end,
      resolved_by = case when p_status = 'resolved' then auth.uid() else resolved_by end
  where id = p_alert_id
  returning * into updated_alert;
  return updated_alert;
end;
$$;

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
  if caller_role is null then raise exception 'Unauthorized'; end if;
  if p_action not in ('add', 'remove', 'restore', 'update') then raise exception 'Invalid admin action'; end if;

  if p_action = 'add' then
    if caller_role not in ('ceo_owner', 'super_admin') or p_user_id is null then raise exception 'Not permitted'; end if;
    if p_role not in ('ceo_owner', 'super_admin', 'a_admin', 'b_admin', 'admin', 'support') then raise exception 'Invalid admin role'; end if;
    if p_role = 'ceo_owner' and caller_role <> 'ceo_owner' then raise exception 'Only the CEO can create a CEO admin'; end if;
    insert into public.admin_team(user_id, email, full_name, role, permissions, status, created_at)
    select p.id, p.email, p.full_name, coalesce(p_role, 'support'), coalesce(p_permissions, ARRAY[]::text[]), 'active', now()
    from public.profiles p where p.id = p_user_id
    on conflict (user_id) do update set role = excluded.role, permissions = excluded.permissions, status = 'active', full_name = excluded.full_name, email = excluded.email
    returning * into target;
    if target.id is null then raise exception 'User profile not found'; end if;
    return target;
  end if;

  select * into target from public.admin_team where id = p_member_id for update;
  if target.id is null then raise exception 'Admin member not found'; end if;
  if p_action = 'update' and p_role is not null and p_role not in ('ceo_owner', 'super_admin', 'a_admin', 'b_admin', 'admin', 'support') then raise exception 'Invalid admin role'; end if;
  if p_action = 'update' and p_role = 'ceo_owner' and caller_role <> 'ceo_owner' then raise exception 'Only the CEO can promote a CEO admin'; end if;
  if target.role = 'ceo_owner' and caller_role <> 'ceo_owner' then raise exception 'Only the CEO can manage the CEO account'; end if;
  if target.user_id = auth.uid() and p_action in ('remove', 'update') then raise exception 'You cannot remove or demote your own active admin account'; end if;
  if caller_role <> 'ceo_owner' and target.role in ('super_admin', 'ceo_owner') then raise exception 'Only the CEO can manage senior admins'; end if;

  if p_action = 'remove' then
    update public.admin_team set status = 'inactive' where id = target.id returning * into target;
  elsif p_action = 'restore' then
    update public.admin_team set status = 'active' where id = target.id returning * into target;
  else
    update public.admin_team set role = coalesce(p_role, role), permissions = coalesce(p_permissions, permissions) where id = target.id returning * into target;
  end if;
  return target;
end;
$$;

revoke all on function public.create_security_alert(text, text, text, text, text, jsonb, uuid[]) from public;
revoke all on function public.set_security_alert_viewers(uuid, uuid[]) from public;
revoke all on function public.update_security_alert_status(uuid, text) from public;
revoke all on function public.manage_admin_member(text, uuid, uuid, text, text[]) from public;
grant execute on function public.create_security_alert(text, text, text, text, text, jsonb, uuid[]) to authenticated;
grant execute on function public.set_security_alert_viewers(uuid, uuid[]) to authenticated;
grant execute on function public.update_security_alert_status(uuid, text) to authenticated;
grant execute on function public.manage_admin_member(text, uuid, uuid, text, text[]) to authenticated;