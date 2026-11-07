create table if not exists public.cardano_auth_challenges (
  id uuid primary key,
  address_hex text not null,
  ip_hash text not null,
  message text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint cardano_auth_challenges_address_hex_format
    check (address_hex ~ '^(?:[0-9a-f]{2})+$'),
  constraint cardano_auth_challenges_ip_hash_format
    check (ip_hash ~ '^[0-9a-f]{64}$'),
  constraint cardano_auth_challenges_expiry
    check (expires_at > created_at)
);

create index if not exists cardano_auth_challenges_address_created_idx
  on public.cardano_auth_challenges (address_hex, created_at desc);
create index if not exists cardano_auth_challenges_ip_created_idx
  on public.cardano_auth_challenges (ip_hash, created_at desc);

alter table public.cardano_auth_challenges enable row level security;
revoke all on public.cardano_auth_challenges from anon, authenticated;
grant all on public.cardano_auth_challenges to service_role;
