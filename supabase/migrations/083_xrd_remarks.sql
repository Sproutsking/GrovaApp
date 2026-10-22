create table if not exists public.xrd_remarks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  evidence_item_id text references public.evidence_items(id) on delete set null,
  record_title text not null,
  remark_type text not null check (remark_type in ('CONTEXT', 'CONFIRM', 'CORRECTION', 'DISPUTE', 'RECOGNITION')),
  body text not null check (char_length(trim(body)) between 5 and 3000),
  author_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'published' check (status in ('published', 'withdrawn')),
  owner_response text,
  owner_response_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists xrd_remarks_profile_created_idx
  on public.xrd_remarks(profile_id, created_at desc);
create index if not exists xrd_remarks_evidence_idx
  on public.xrd_remarks(evidence_item_id);

alter table public.xrd_remarks enable row level security;

drop policy if exists "XRD remarks are visible to profile viewers" on public.xrd_remarks;
create policy "XRD remarks are visible to profile viewers"
  on public.xrd_remarks for select to authenticated
  using (status = 'published' or profile_id = auth.uid() or author_id = auth.uid());

drop policy if exists "Authenticated viewers can publish XRD remarks" on public.xrd_remarks;
create policy "Authenticated viewers can publish XRD remarks"
  on public.xrd_remarks for insert to authenticated
  with check (author_id = auth.uid() and status = 'published');

drop policy if exists "Profile owners can respond to XRD remarks" on public.xrd_remarks;
create policy "Profile owners can respond to XRD remarks"
  on public.xrd_remarks for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant select, insert on public.xrd_remarks to authenticated;
revoke update on public.xrd_remarks from authenticated;
grant update (owner_response, owner_response_at) on public.xrd_remarks to authenticated;