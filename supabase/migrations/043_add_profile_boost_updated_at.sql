-- The boost save RPCs update profile_boosts.updated_at, but older databases
-- were created without that column. Add it idempotently for all boost saves.
alter table public.profile_boosts
  add column if not exists updated_at timestamp with time zone not null default now();

update public.profile_boosts
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;
