create table if not exists public.identity_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chain text not null check (chain in ('ethereum', 'solana', 'cardano')),
  address text not null,
  address_key text not null,
  wallet_name text not null default '',
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint identity_wallets_chain_address_key unique (chain, address_key)
);

create index if not exists identity_wallets_user_created_idx
  on public.identity_wallets (user_id, created_at desc);

create table if not exists public.wallet_identity_challenges (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  chain text not null check (chain in ('ethereum', 'solana', 'cardano')),
  address text not null,
  address_key text not null,
  message text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint wallet_identity_challenges_expiry check (expires_at > created_at)
);

create index if not exists wallet_identity_challenges_user_created_idx
  on public.wallet_identity_challenges (user_id, created_at desc);

alter table public.identity_wallets enable row level security;
alter table public.wallet_identity_challenges enable row level security;

revoke all on public.identity_wallets from anon, authenticated;
grant select, delete on public.identity_wallets to authenticated;
grant all on public.identity_wallets to service_role;

revoke all on public.wallet_identity_challenges from anon, authenticated;
grant all on public.wallet_identity_challenges to service_role;

drop policy if exists "Users can view their verified wallet identities"
  on public.identity_wallets;
create policy "Users can view their verified wallet identities"
  on public.identity_wallets for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can remove their verified wallet identities"
  on public.identity_wallets;
create policy "Users can remove their verified wallet identities"
  on public.identity_wallets for delete to authenticated
  using (auth.uid() = user_id);
