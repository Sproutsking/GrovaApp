create table if not exists public.xrd_identity_details (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  field_key text not null check (field_key in ('headline', 'bio', 'location', 'pronouns', 'website', 'note', 'availability')),
  value text not null default '' check (char_length(value) <= 4000),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  status text not null default 'self_asserted' check (status in ('self_asserted', 'pending', 'source_reported', 'verified', 'disputed', 'expired', 'revoked')),
  updated_at timestamptz not null default now(),
  primary key (profile_id, field_key)
);

alter table public.xrd_identity_details enable row level security;
revoke all on table public.xrd_identity_details from anon, authenticated;
grant select, delete on table public.xrd_identity_details to authenticated;
grant insert (profile_id, field_key, value, visibility, updated_at) on public.xrd_identity_details to authenticated;
grant update (value, visibility, updated_at) on public.xrd_identity_details to authenticated;
grant all on table public.xrd_identity_details to service_role;

drop policy if exists "XRD identity details owner or public read" on public.xrd_identity_details;
create policy "XRD identity details owner or public read"
  on public.xrd_identity_details for select to authenticated
  using (profile_id = auth.uid() or visibility = 'public');

drop policy if exists "XRD identity details owner insert" on public.xrd_identity_details;
create policy "XRD identity details owner insert"
  on public.xrd_identity_details for insert to authenticated
  with check (profile_id = auth.uid() and status = 'self_asserted');

drop policy if exists "XRD identity details owner update" on public.xrd_identity_details;
create policy "XRD identity details owner update"
  on public.xrd_identity_details for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "XRD identity details owner delete" on public.xrd_identity_details;
create policy "XRD identity details owner delete"
  on public.xrd_identity_details for delete to authenticated
  using (profile_id = auth.uid());