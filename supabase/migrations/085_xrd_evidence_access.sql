create table if not exists public.xrd_access_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 5 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (profile_id <> requester_id)
);

create unique index if not exists xrd_access_requests_one_pending_per_pair
  on public.xrd_access_requests(profile_id, requester_id)
  where status = 'pending';
create index if not exists xrd_access_requests_profile_created_idx
  on public.xrd_access_requests(profile_id, created_at desc);

create table if not exists public.xrd_evidence_grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  evidence_item_id text not null references public.evidence_items(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid references public.xrd_access_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (evidence_item_id, viewer_id)
);

create index if not exists xrd_evidence_grants_viewer_idx
  on public.xrd_evidence_grants(viewer_id, evidence_item_id);

alter table public.xrd_access_requests enable row level security;
alter table public.xrd_evidence_grants enable row level security;

drop policy if exists "XRD requester or owner can read requests" on public.xrd_access_requests;
create policy "XRD requester or owner can read requests"
  on public.xrd_access_requests for select to authenticated
  using (requester_id = auth.uid() or profile_id = auth.uid());

drop policy if exists "Authenticated visitors can request XRD evidence" on public.xrd_access_requests;
create policy "Authenticated visitors can request XRD evidence"
  on public.xrd_access_requests for insert to authenticated
  with check (requester_id = auth.uid() and profile_id <> auth.uid() and status = 'pending');

drop policy if exists "XRD profile owners can answer requests" on public.xrd_access_requests;
create policy "XRD profile owners can answer requests"
  on public.xrd_access_requests for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "XRD grant owners and viewers can read grants" on public.xrd_evidence_grants;
create policy "XRD grant owners and viewers can read grants"
  on public.xrd_evidence_grants for select to authenticated
  using (viewer_id = auth.uid() or profile_id = auth.uid());

drop policy if exists "XRD profile owners can grant evidence" on public.xrd_evidence_grants;
create policy "XRD profile owners can grant evidence"
  on public.xrd_evidence_grants for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.evidence_items item
      where item.id = evidence_item_id and item.profile_id = auth.uid()
    )
  );

drop policy if exists "XRD profile owners can revoke evidence grants" on public.xrd_evidence_grants;
create policy "XRD profile owners can revoke evidence grants"
  on public.xrd_evidence_grants for delete to authenticated
  using (profile_id = auth.uid());

drop policy if exists "Owners can update evidence visibility" on public.evidence_items;
create policy "Owners can update evidence visibility"
  on public.evidence_items for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "Authenticated users can read permitted evidence" on public.evidence_items;
create policy "Authenticated users can read permitted evidence"
  on public.evidence_items for select to authenticated
  using (
    auth.role() = 'service_role'
    or profile_id = auth.uid()
    or (
      verified = true
      and coalesce(upper(metadata->>'visibility'), 'PUBLIC') = 'PUBLIC'
    )
    or exists (
      select 1 from public.xrd_evidence_grants grant_row
      where grant_row.evidence_item_id = evidence_items.id
        and grant_row.viewer_id = auth.uid()
    )
  );

grant select, insert on public.xrd_access_requests to authenticated;
revoke update on public.xrd_access_requests from authenticated;
grant update (status, responded_at) on public.xrd_access_requests to authenticated;
grant select, insert, delete on public.xrd_evidence_grants to authenticated;