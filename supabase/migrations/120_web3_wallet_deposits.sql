create table if not exists public.web3_wallet_deposit_challenges (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  chain_type text not null check (chain_type in ('EVM', 'SOLANA', 'CARDANO')),
  chain_name text not null,
  asset_symbol text not null check (asset_symbol in ('USDC', 'USDT', 'ADA')),
  wallet_address text not null,
  message text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint web3_wallet_deposit_challenges_expiry
    check (expires_at > created_at)
);

create index if not exists web3_wallet_deposit_challenges_user_created_idx
  on public.web3_wallet_deposit_challenges (user_id, created_at desc);

create table if not exists public.web3_wallet_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  chain_type text not null check (chain_type in ('EVM', 'SOLANA', 'CARDANO')),
  chain_name text not null,
  asset_symbol text not null check (asset_symbol in ('USDC', 'USDT', 'ADA')),
  tx_hash text not null,
  wallet_address text not null,
  asset_amount numeric(38, 18) not null check (asset_amount > 0),
  usd_amount numeric(18, 6) not null check (usd_amount > 0),
  ep_credited bigint not null check (ep_credited >= 100),
  balance_after numeric not null check (balance_after >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint web3_wallet_deposits_chain_asset_check check (
    (chain_type = 'EVM'
      and chain_name in ('ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'bnb', 'avalanche', 'zksync', 'fantom')
      and asset_symbol in ('USDC', 'USDT'))
    or (chain_type = 'SOLANA' and chain_name = 'solana' and asset_symbol in ('USDC', 'USDT'))
    or (chain_type = 'CARDANO' and chain_name = 'cardano' and asset_symbol = 'ADA')
  ),
  constraint web3_wallet_deposits_tx_hash_unique unique (chain_type, chain_name, tx_hash)
);

create index if not exists web3_wallet_deposits_user_created_idx
  on public.web3_wallet_deposits (user_id, created_at desc);

alter table public.web3_wallet_deposit_challenges enable row level security;
alter table public.web3_wallet_deposits enable row level security;

revoke all on public.web3_wallet_deposit_challenges from anon, authenticated;
revoke all on public.web3_wallet_deposits from anon, authenticated;
grant all on public.web3_wallet_deposit_challenges to service_role;
grant all on public.web3_wallet_deposits to service_role;

create or replace function public.settle_web3_wallet_deposit(
  p_challenge_id uuid,
  p_user_id uuid,
  p_chain_type text,
  p_chain_name text,
  p_asset_symbol text,
  p_tx_hash text,
  p_wallet_address text,
  p_asset_amount numeric,
  p_usd_amount numeric,
  p_ep_amount bigint,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.web3_wallet_deposit_challenges%rowtype;
  v_existing public.web3_wallet_deposits%rowtype;
  v_deposit_id uuid;
  v_balance_before numeric;
  v_balance_after numeric;
begin
  if p_user_id is null or p_challenge_id is null
     or p_chain_type not in ('EVM', 'SOLANA', 'CARDANO')
     or p_chain_name is null or p_asset_symbol is null
     or p_tx_hash is null or length(p_tx_hash) > 160
     or p_wallet_address is null or length(p_wallet_address) > 128
     or p_asset_amount is null or p_asset_amount <= 0 or p_asset_amount::text = 'NaN'
     or p_usd_amount is null or p_usd_amount < 1 or p_usd_amount::text = 'NaN'
     or p_ep_amount is null or p_ep_amount < 100
     or p_ep_amount <> floor(p_usd_amount * 100)::bigint then
    raise exception 'Invalid Web3 deposit settlement data' using errcode = '22023';
  end if;

  select * into v_existing
  from public.web3_wallet_deposits
  where chain_type = p_chain_type
    and chain_name = p_chain_name
    and tx_hash = p_tx_hash;

  if found then
    if v_existing.user_id <> p_user_id then
      raise exception 'Transaction has already been claimed' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'success', true,
      'already_credited', true,
      'deposit_id', v_existing.id,
      'ep_credited', v_existing.ep_credited,
      'balance_after', v_existing.balance_after
    );
  end if;

  select * into v_challenge
  from public.web3_wallet_deposit_challenges
  where id = p_challenge_id and user_id = p_user_id
  for update;

  if not found or v_challenge.consumed_at is not null or v_challenge.expires_at <= now() then
    raise exception 'Deposit wallet proof expired or already used' using errcode = '22023';
  end if;

  if v_challenge.chain_type <> p_chain_type
     or v_challenge.chain_name <> p_chain_name
     or v_challenge.asset_symbol <> p_asset_symbol
     or v_challenge.wallet_address <> p_wallet_address then
    raise exception 'Deposit wallet proof does not match the transaction' using errcode = '22023';
  end if;

  insert into public.wallets (user_id, xev_tokens, engagement_points, paywave_balance)
  values (p_user_id, 0, 0, 0)
  on conflict (user_id) do nothing;

  select coalesce(engagement_points, 0)
    into v_balance_before
  from public.wallets
  where user_id = p_user_id
  for update;

  v_balance_after := v_balance_before + p_ep_amount;

  insert into public.web3_wallet_deposits (
    user_id, chain_type, chain_name, asset_symbol, tx_hash, wallet_address,
    asset_amount, usd_amount, ep_credited, balance_after, metadata
  )
  values (
    p_user_id, p_chain_type, p_chain_name, p_asset_symbol, p_tx_hash, p_wallet_address,
    p_asset_amount, p_usd_amount, p_ep_amount, v_balance_after,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (chain_type, chain_name, tx_hash) do nothing
  returning id into v_deposit_id;

  if v_deposit_id is null then
    select * into v_existing
    from public.web3_wallet_deposits
    where chain_type = p_chain_type
      and chain_name = p_chain_name
      and tx_hash = p_tx_hash;

    if v_existing.user_id <> p_user_id then
      raise exception 'Transaction has already been claimed' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'success', true,
      'already_credited', true,
      'deposit_id', v_existing.id,
      'ep_credited', v_existing.ep_credited,
      'balance_after', v_existing.balance_after
    );
  end if;

  update public.wallets
  set engagement_points = v_balance_after,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.ep_transactions (
    user_id, amount, balance_after, type, reason, metadata
  )
  values (
    p_user_id,
    p_ep_amount,
    v_balance_after,
    'purchase_grant',
    'Web3 wallet deposit',
    jsonb_build_object(
      'deposit_id', v_deposit_id,
      'chain_type', p_chain_type,
      'chain_name', p_chain_name,
      'asset_symbol', p_asset_symbol,
      'asset_amount', p_asset_amount,
      'usd_amount', p_usd_amount,
      'tx_hash', p_tx_hash,
      'wallet_address', p_wallet_address
    )
  );

  update public.web3_wallet_deposit_challenges
  set consumed_at = now()
  where id = p_challenge_id;

  return jsonb_build_object(
    'success', true,
    'already_credited', false,
    'deposit_id', v_deposit_id,
    'ep_credited', p_ep_amount,
    'balance_after', v_balance_after
  );
end;
$$;

revoke all on function public.settle_web3_wallet_deposit(
  uuid, uuid, text, text, text, text, text, numeric, numeric, bigint, jsonb
) from public, anon, authenticated;
grant execute on function public.settle_web3_wallet_deposit(
  uuid, uuid, text, text, text, text, text, numeric, numeric, bigint, jsonb
) to service_role;
