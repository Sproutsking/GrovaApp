create table if not exists public.xrd_identity_bindings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  connection_id uuid references public.connections(id) on delete set null,
  provider text not null,
  external_subject_id text not null,
  binding_method text not null check (binding_method in ('oauth_popup', 'supabase_identity', 'profile_link', 'manual')),
  assurance_scope text not null check (assurance_scope in ('account_control', 'profile_reference', 'profile_match', 'personhood', 'institutional_attestation')),
  status text not null default 'bound' check (status in ('claimed', 'pending', 'bound', 'verified', 'disputed', 'expired', 'revoked', 'failed')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  evidence_id text references public.evidence_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists xrd_identity_bindings_profile_idx
  on public.xrd_identity_bindings(profile_id, created_at desc);

alter table public.xrd_identity_bindings enable row level security;
revoke all on table public.xrd_identity_bindings from anon;
grant select, insert, update on public.xrd_identity_bindings to authenticated;

drop policy if exists "XRD binding owner or public read" on public.xrd_identity_bindings;
create policy "XRD binding owner or public read"
  on public.xrd_identity_bindings for select to authenticated
  using (profile_id = auth.uid() or visibility = 'public');

drop policy if exists "XRD owners can create non-verified bindings" on public.xrd_identity_bindings;
create policy "XRD owners can create non-verified bindings"
  on public.xrd_identity_bindings for insert to authenticated
  with check (
    profile_id = auth.uid()
    and status in ('claimed', 'pending', 'bound')
  );

drop policy if exists "XRD owners can update their bindings" on public.xrd_identity_bindings;
create policy "XRD owners can update their bindings"
  on public.xrd_identity_bindings for update to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and status in ('claimed', 'pending', 'bound', 'disputed', 'expired', 'revoked', 'failed')
  );

create table if not exists public.xrd_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  record_type text not null check (record_type in ('employment', 'education', 'project', 'credential', 'contribution', 'community', 'achievement', 'identity', 'other')),
  title text not null check (char_length(trim(title)) between 2 and 180),
  claim_text text not null check (char_length(trim(claim_text)) between 5 and 4000),
  structured_claim jsonb not null default '{}'::jsonb,
  lifecycle_status text not null default 'published' check (lifecycle_status in ('draft', 'published', 'withdrawn', 'superseded')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  supersedes_id uuid references public.xrd_records(id) on delete set null,
  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (created_by = profile_id)
);

create index if not exists xrd_records_profile_created_idx
  on public.xrd_records(profile_id, created_at desc);
create index if not exists xrd_records_profile_type_status_idx
  on public.xrd_records(profile_id, record_type, lifecycle_status);

alter table public.xrd_records enable row level security;
revoke all on table public.xrd_records from anon;
grant select, insert, update on public.xrd_records to authenticated;

drop policy if exists "XRD records owner or published public read" on public.xrd_records;
create policy "XRD records owner or published public read"
  on public.xrd_records for select to authenticated
  using (
    profile_id = auth.uid()
    or (lifecycle_status = 'published' and visibility = 'public')
  );

drop policy if exists "XRD owners can create records" on public.xrd_records;
create policy "XRD owners can create records"
  on public.xrd_records for insert to authenticated
  with check (profile_id = auth.uid() and created_by = auth.uid());

drop policy if exists "XRD owners can update records" on public.xrd_records;
create policy "XRD owners can update records"
  on public.xrd_records for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and created_by = auth.uid());

create table if not exists public.xrd_record_evidence (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.xrd_records(id) on delete cascade,
  evidence_item_id text not null references public.evidence_items(id) on delete cascade,
  relation text not null check (relation in ('supports', 'contradicts')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (record_id, evidence_item_id, relation)
);

create index if not exists xrd_record_evidence_record_idx
  on public.xrd_record_evidence(record_id, created_at);
create index if not exists xrd_record_evidence_item_idx
  on public.xrd_record_evidence(evidence_item_id);

alter table public.xrd_record_evidence enable row level security;
revoke all on table public.xrd_record_evidence from anon;
grant select, insert, delete on public.xrd_record_evidence to authenticated;

drop policy if exists "XRD evidence links visible with record" on public.xrd_record_evidence;
create policy "XRD evidence links visible with record"
  on public.xrd_record_evidence for select to authenticated
  using (exists (
    select 1 from public.xrd_records record_row
    where record_row.id = record_id
      and (record_row.profile_id = auth.uid() or (record_row.lifecycle_status = 'published' and record_row.visibility = 'public'))
  ) and exists (
    select 1 from public.evidence_items evidence_row
    where evidence_row.id = evidence_item_id
      and (
        evidence_row.profile_id = auth.uid()
        or (
          evidence_row.verified = true
          and coalesce(upper(evidence_row.metadata->>'visibility'), 'PUBLIC') = 'PUBLIC'
        )
        or exists (
          select 1 from public.xrd_evidence_grants grant_row
          where grant_row.evidence_item_id = evidence_row.id and grant_row.viewer_id = auth.uid()
        )
      )
  ));

drop policy if exists "XRD owners can link their evidence" on public.xrd_record_evidence;
create policy "XRD owners can link their evidence"
  on public.xrd_record_evidence for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.xrd_records r where r.id = record_id and r.profile_id = auth.uid())
    and exists (select 1 from public.evidence_items e where e.id = evidence_item_id and e.profile_id = auth.uid())
  );

drop policy if exists "XRD owners can remove their evidence links" on public.xrd_record_evidence;
create policy "XRD owners can remove their evidence links"
  on public.xrd_record_evidence for delete to authenticated
  using (exists (select 1 from public.xrd_records r where r.id = record_id and r.profile_id = auth.uid()));

create table if not exists public.xrd_source_check_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  record_id uuid references public.xrd_records(id) on delete set null,
  evidence_item_id text references public.evidence_items(id) on delete set null,
  provider text not null,
  method text not null,
  run_status text not null check (run_status in ('completed', 'failed')),
  result_status text not null check (result_status in ('matched', 'changed', 'not_found', 'unavailable', 'indeterminate')),
  checked_fields jsonb not null default '[]'::jsonb,
  summary text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  initiated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (initiated_by = profile_id)
);

create index if not exists xrd_source_check_runs_record_idx
  on public.xrd_source_check_runs(record_id, created_at desc);
create index if not exists xrd_source_check_runs_evidence_idx
  on public.xrd_source_check_runs(evidence_item_id, created_at desc);

alter table public.xrd_source_check_runs enable row level security;
revoke all on table public.xrd_source_check_runs from anon;
grant select, insert on public.xrd_source_check_runs to authenticated;

drop policy if exists "XRD source check owner read" on public.xrd_source_check_runs;
create policy "XRD source check owner read"
  on public.xrd_source_check_runs for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "XRD owner can record source observations" on public.xrd_source_check_runs;
create policy "XRD owner can record source observations"
  on public.xrd_source_check_runs for insert to authenticated
  with check (
    profile_id = auth.uid()
    and initiated_by = auth.uid()
    and (record_id is null or exists (select 1 from public.xrd_records r where r.id = record_id and r.profile_id = auth.uid()))
    and (evidence_item_id is null or exists (select 1 from public.evidence_items e where e.id = evidence_item_id and e.profile_id = auth.uid()))
  );

create table if not exists public.xrd_audit_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (actor_id = profile_id)
);

create index if not exists xrd_audit_events_profile_created_idx
  on public.xrd_audit_events(profile_id, created_at desc);

alter table public.xrd_audit_events enable row level security;
revoke all on table public.xrd_audit_events from anon;
grant select, insert on public.xrd_audit_events to authenticated;

drop policy if exists "XRD audit events owner read" on public.xrd_audit_events;
create policy "XRD audit events owner read"
  on public.xrd_audit_events for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "XRD audit events append by owner" on public.xrd_audit_events;
create policy "XRD audit events append by owner"
  on public.xrd_audit_events for insert to authenticated
  with check (profile_id = auth.uid() and actor_id = auth.uid());

revoke update, delete on table public.xrd_audit_events from authenticated;