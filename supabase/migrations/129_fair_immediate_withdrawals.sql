create table if not exists public.liquidity_config (
  singleton boolean primary key default true check (singleton),
  ep_per_usd numeric not null default 100,
  platform_fee_pct numeric not null default 2,
  silver_max_usd numeric not null default 1000,
  gold_max_usd numeric not null default 10000,
  diamond_max_usd numeric not null default 50000,
  warning_threshold numeric not null default 0.3,
  critical_threshold numeric not null default 0.15,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.liquidity_config
  add column if not exists ep_per_usd numeric not null default 100,
  add column if not exists platform_fee_pct numeric not null default 2,
  add column if not exists silver_max_usd numeric not null default 1000,
  add column if not exists gold_max_usd numeric not null default 10000,
  add column if not exists diamond_max_usd numeric not null default 50000,
  add column if not exists warning_threshold numeric not null default 0.3,
  add column if not exists critical_threshold numeric not null default 0.15,
  add column if not exists updated_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

insert into public.liquidity_config (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.liquidity_config enable row level security;
revoke all on public.liquidity_config from public, anon;
grant select, update on public.liquidity_config to authenticated;

drop policy if exists liquidity_config_admin_read on public.liquidity_config;
create policy liquidity_config_admin_read on public.liquidity_config
  for select to authenticated
  using (public.current_admin_role() is not null);

drop policy if exists liquidity_config_admin_update on public.liquidity_config;
create policy liquidity_config_admin_update on public.liquidity_config
  for update to authenticated
  using (public.current_admin_role() is not null)
  with check (public.current_admin_role() is not null);

create table if not exists public.withdrawal_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key uuid,
  transaction_id uuid references public.transactions(id),
  ep_amount numeric not null check (ep_amount > 0),
  usd_amount numeric not null check (usd_amount > 0),
  processing_tier text,
  reward_level_at_request text,
  fee_pct numeric,
  fee_ep numeric,
  fee_amount numeric,
  net_ep numeric not null check (net_ep > 0),
  status text not null default 'processing',
  destination_type text not null,
  destination_info jsonb not null default '{}'::jsonb,
  destination text,
  pin_verified boolean not null default false,
  ngn_rate numeric,
  requested_at timestamptz not null default now(),
  estimated_at timestamptz,
  processed_at timestamptz,
  completed_at timestamptz,
  error_msg text,
  admin_notes text,
  system_state_at_submit jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.withdrawal_queue
  add column if not exists idempotency_key uuid,
  add column if not exists transaction_id uuid references public.transactions(id),
  add column if not exists reward_level_at_request text,
  add column if not exists fee_amount numeric,
  add column if not exists completed_at timestamptz,
  add column if not exists admin_notes text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists ep_amount numeric,
  add column if not exists usd_amount numeric,
  add column if not exists processing_tier text,
  add column if not exists fee_pct numeric,
  add column if not exists fee_ep numeric,
  add column if not exists net_ep numeric,
  add column if not exists status text not null default 'processing',
  add column if not exists destination_type text,
  add column if not exists destination_info jsonb not null default '{}'::jsonb,
  add column if not exists pin_verified boolean not null default false,
  add column if not exists ngn_rate numeric,
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists processed_at timestamptz,
  add column if not exists estimated_at timestamptz,
  add column if not exists error_msg text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists withdrawal_queue_idempotency_key_uidx
  on public.withdrawal_queue (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists withdrawal_queue_paystack_reference_uidx
  on public.withdrawal_queue ((metadata->>'paystack_reference'))
  where metadata ? 'paystack_reference';

create index if not exists withdrawal_queue_user_requested_idx
  on public.withdrawal_queue (user_id, requested_at desc);

create index if not exists withdrawal_queue_status_requested_idx
  on public.withdrawal_queue (status, requested_at);

alter table public.withdrawal_queue enable row level security;
revoke all on public.withdrawal_queue from public, anon, authenticated;
grant select on public.withdrawal_queue to authenticated;

drop policy if exists withdrawal_queue_owner_or_admin_read on public.withdrawal_queue;
create policy withdrawal_queue_owner_or_admin_read on public.withdrawal_queue
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_admin_role() is not null
  );

create or replace function public.get_withdrawal_policy()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_reward_level text;
  v_max_usd numeric;
  v_ep_per_usd numeric := 100;
  v_platform_fee_pct numeric := 2;
  v_ngn_rate numeric := 1366;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select lower(coalesce(reward_level, 'none'))
    into v_reward_level
  from public.profiles
  where id = v_user_id;

  select ep_per_usd, platform_fee_pct,
         case v_reward_level
           when 'silver' then silver_max_usd
           when 'gold' then gold_max_usd
           when 'diamond' then diamond_max_usd
           else 0
         end
    into v_ep_per_usd, v_platform_fee_pct, v_max_usd
  from public.liquidity_config
  where singleton = true;

  if not found then
    v_ep_per_usd := 100;
    v_platform_fee_pct := 2;
    v_max_usd := case v_reward_level
      when 'silver' then 1000
      when 'gold' then 10000
      when 'diamond' then 50000
      else 0
    end;
  end if;

  begin
    select (value->>'ngn_rate')::numeric
      into v_ngn_rate
    from public.platform_settings
    where key = 'paywall_config';
  exception when undefined_table or invalid_text_representation then
    v_ngn_rate := 1366;
  end;

  if v_ep_per_usd is null or v_ep_per_usd <= 0 or v_ep_per_usd > 10000
     or v_platform_fee_pct is null or v_platform_fee_pct < 0 or v_platform_fee_pct > 25 then
    raise exception 'Withdrawal configuration is invalid' using errcode = '22023';
  end if;
  if v_ngn_rate is null or v_ngn_rate < 100 or v_ngn_rate > 1000000 then
    v_ngn_rate := 1366;
  end if;

  return jsonb_build_object(
    'reward_level', coalesce(v_reward_level, 'none'),
    'eligible', coalesce(v_max_usd, 0) > 0,
    'max_per_request_ep', coalesce(v_max_usd, 0) * v_ep_per_usd,
    'daily_limit_ep', 50000,
    'ep_per_usd', v_ep_per_usd,
    'fee_pct', v_platform_fee_pct,
    'ngn_rate', v_ngn_rate
  );
end;
$$;

create or replace function public.initiate_direct_withdrawal(
  p_idempotency_key uuid,
  p_ep_amount bigint,
  p_destination_info jsonb,
  p_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_reward_level text;
  v_processing_tier integer;
  v_ep_per_usd numeric := 100;
  v_platform_fee_pct numeric := 2;
  v_max_usd numeric;
  v_max_ep numeric;
  v_fee_ep numeric;
  v_net_ep numeric;
  v_ngn_rate numeric := 1366;
  v_net_ngn numeric;
  v_balance_before numeric;
  v_balance_after numeric;
  v_daily_used numeric;
  v_hourly_count integer;
  v_last_request timestamptz;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_expected_pin text;
  v_attempts integer;
  v_lock_until timestamptz;
  v_wallet public.wallets%rowtype;
  v_existing public.withdrawal_queue%rowtype;
  v_withdrawal_id uuid := gen_random_uuid();
  v_transaction_id uuid := gen_random_uuid();
  v_reference text;
  v_bank text;
  v_account_number text;
  v_account_name text;
  v_bank_code text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_idempotency_key is null
     or p_ep_amount is null
     or p_ep_amount < 500
     or p_destination_info is null then
    return jsonb_build_object('success', false, 'error', 'Enter a valid withdrawal request.');
  end if;

  select *
    into v_existing
  from public.withdrawal_queue
  where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.user_id <> v_user_id then
      raise exception 'Idempotency key belongs to another account' using errcode = '42501';
    end if;
    return jsonb_build_object(
      'success', true,
      'id', v_existing.id,
      'transaction_id', v_existing.transaction_id,
      'status', v_existing.status,
      'ep_amount', v_existing.ep_amount,
      'fee_ep', v_existing.fee_ep,
      'net_ep', v_existing.net_ep,
      'net_ngn', round(
        coalesce(v_existing.net_ep, 0)
        / coalesce(nullif(v_existing.metadata->>'ep_per_usd', '')::numeric, 100)
        * coalesce(v_existing.ngn_rate, 1366)
      ),
      'fee_pct', v_existing.fee_pct,
      'processing_tier', v_existing.processing_tier,
      'ngn_rate', v_existing.ngn_rate,
      'payout_state', v_existing.metadata->>'payout_state',
      'refunded', v_existing.metadata->>'ep_refunded' = 'true',
      'already_created', true
    );
  end if;

  if p_destination_info->>'method' is not null
     and p_destination_info->>'method' <> 'bank' then
    return jsonb_build_object('success', false, 'error', 'Only bank withdrawals are currently available.');
  end if;
  v_bank := trim(coalesce(p_destination_info->>'bank', ''));
  v_account_number := trim(coalesce(p_destination_info->>'account_number', ''));
  v_account_name := trim(coalesce(p_destination_info->>'account_name', ''));
  v_bank_code := nullif(trim(coalesce(p_destination_info->>'bank_code', '')), '');
  if length(v_bank) < 2 or length(v_bank) > 120
     or v_account_number !~ '^[0-9]{10}$'
     or length(v_account_name) < 2 or length(v_account_name) > 120
     or (v_bank_code is not null and length(v_bank_code) > 12) then
    return jsonb_build_object('success', false, 'error', 'Enter valid Nigerian bank details.');
  end if;

  select lower(coalesce(reward_level, 'none'))
    into v_reward_level
  from public.profiles
  where id = v_user_id
  for share;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Account profile not found.');
  end if;

  case v_reward_level
    when 'silver' then v_processing_tier := 1;
    when 'gold' then v_processing_tier := 2;
    when 'diamond' then v_processing_tier := 3;
    else return jsonb_build_object(
      'success', false,
      'error', 'Reach Silver reward level to become eligible for withdrawals.'
    );
  end case;

  begin
    select ep_per_usd, platform_fee_pct,
           case v_reward_level
             when 'silver' then silver_max_usd
             when 'gold' then gold_max_usd
             else diamond_max_usd
           end
      into v_ep_per_usd, v_platform_fee_pct, v_max_usd
    from public.liquidity_config
    where singleton = true;
  exception when undefined_table then
    v_ep_per_usd := 100;
    v_platform_fee_pct := 2;
    v_max_usd := case v_reward_level
      when 'silver' then 1000
      when 'gold' then 10000
      else 50000
    end;
  end;
  if v_max_usd is null then
    v_max_usd := case v_reward_level
      when 'silver' then 1000
      when 'gold' then 10000
      else 50000
    end;
  end if;
  if v_ep_per_usd is null or v_ep_per_usd <= 0 or v_ep_per_usd > 10000
     or v_platform_fee_pct is null or v_platform_fee_pct < 0 or v_platform_fee_pct > 25
     or v_max_usd <= 0 or v_max_usd > 1000000 then
    raise exception 'Withdrawal configuration is invalid' using errcode = '22023';
  end if;
  v_max_ep := v_max_usd * v_ep_per_usd;
  if p_ep_amount > v_max_ep then
    return jsonb_build_object(
      'success', false,
      'error', format('This request exceeds your %s limit of %s EP.', initcap(v_reward_level), to_char(v_max_ep, 'FM999,999,999'))
    );
  end if;

  insert into public.wallets (user_id, xev_tokens, engagement_points, paywave_balance)
  values (v_user_id, 0, 0, 0)
  on conflict (user_id) do nothing;
  select *
    into v_wallet
  from public.wallets
  where user_id = v_user_id
  for update;
  if not found then
    raise exception 'Wallet not found' using errcode = 'P0002';
  end if;

  if p_ep_amount >= 10000 then
    if v_wallet.pin_locked_until is not null and v_wallet.pin_locked_until > now() then
      return jsonb_build_object('success', false, 'error', 'PIN temporarily locked. Try again later.');
    end if;
    if p_pin is null or p_pin !~ '^[0-9]{4,12}$' or v_wallet.withdrawal_pin_hash is null then
      return jsonb_build_object('success', false, 'error', 'A valid transaction PIN is required.');
    end if;
    v_expected_pin := encode(
      extensions.digest(
        convert_to(p_pin || left(replace(v_user_id::text, '-', ''), 16), 'UTF8'),
        'sha256'::text
      ),
      'hex'
    );
    if v_expected_pin <> v_wallet.withdrawal_pin_hash then
      v_attempts := coalesce(v_wallet.pin_attempts, 0) + 1;
      v_lock_until := case when v_attempts >= 5 then now() + interval '15 minutes' else null end;
      update public.wallets
      set pin_attempts = case when v_attempts >= 5 then 0 else v_attempts end,
          pin_locked_until = v_lock_until,
          updated_at = now()
      where id = v_wallet.id;
      insert into public.security_events (user_id, event_type, severity, metadata)
      values (
        v_user_id,
        'withdrawal_pin_failed',
        'warning',
        jsonb_build_object('attempts', v_attempts, 'locked_until', v_lock_until)
      );
      return jsonb_build_object(
        'success', false,
        'error', case when v_lock_until is null then 'Incorrect PIN' else 'Too many incorrect attempts. PIN temporarily locked.' end
      );
    end if;
    update public.wallets
    set pin_attempts = 0, pin_locked_until = null, updated_at = now()
    where id = v_wallet.id;
  end if;

  select coalesce(sum(ep_amount), 0)
    into v_daily_used
  from public.withdrawal_queue
  where user_id = v_user_id
    and requested_at >= v_day_start
    and status not in ('failed', 'cancelled');
  if v_daily_used + p_ep_amount > 50000 then
    return jsonb_build_object('success', false, 'error', 'Daily withdrawal limit of 50,000 EP reached.');
  end if;

  select max(requested_at), count(*)::integer
    into v_last_request, v_hourly_count
  from public.withdrawal_queue
  where user_id = v_user_id
    and requested_at >= now() - interval '1 hour'
    and status not in ('failed', 'cancelled');
  if v_last_request is not null and v_last_request > now() - interval '5 minutes' then
    return jsonb_build_object(
      'success', false,
      'error', format('Please wait %s seconds before your next withdrawal.', ceil(extract(epoch from (v_last_request + interval '5 minutes' - now()))::integer))
    );
  end if;
  if v_hourly_count >= 6 then
    return jsonb_build_object('success', false, 'error', 'Hourly withdrawal limit reached. Try again later.');
  end if;

  if coalesce(v_wallet.engagement_points, 0) < p_ep_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient EP balance.');
  end if;

  begin
    select (value->>'ngn_rate')::numeric
      into v_ngn_rate
    from public.platform_settings
    where key = 'paywall_config';
  exception when undefined_table or invalid_text_representation then
    v_ngn_rate := 1366;
  end;
  if v_ngn_rate is null or v_ngn_rate < 100 or v_ngn_rate > 1000000 then
    v_ngn_rate := 1366;
  end if;

  v_fee_ep := round(p_ep_amount * v_platform_fee_pct / 100);
  v_net_ep := p_ep_amount - v_fee_ep;
  if v_net_ep <= 0 then
    return jsonb_build_object('success', false, 'error', 'Withdrawal is too small after fees.');
  end if;
  v_net_ngn := round(v_net_ep / v_ep_per_usd * v_ngn_rate);
  v_reference := 'xev_wd_' || replace(v_withdrawal_id::text, '-', '');
  v_balance_before := coalesce(v_wallet.engagement_points, 0);
  v_balance_after := v_balance_before - p_ep_amount;

  insert into public.transactions (
    id, from_user_id, amount, type, status, metadata
  )
  values (
    v_transaction_id,
    v_user_id,
    p_ep_amount / v_ep_per_usd,
    'withdrawal',
    'pending',
    jsonb_build_object(
      'withdrawal_id', v_withdrawal_id,
      'currency', 'USD',
      'source', 'wallet_withdrawal',
      'ep_amount', p_ep_amount,
      'fee_ep', v_fee_ep,
      'net_ep', v_net_ep,
      'paystack_reference', v_reference,
      'idempotency_key', p_idempotency_key
    )
  );

  insert into public.withdrawal_queue (
    id, user_id, idempotency_key, transaction_id, ep_amount, usd_amount,
    processing_tier, reward_level_at_request, fee_pct, fee_ep, fee_amount,
    net_ep, status, destination_type, destination_info, pin_verified,
    ngn_rate, requested_at, metadata
  )
  values (
    v_withdrawal_id,
    v_user_id,
    p_idempotency_key,
    v_transaction_id,
    p_ep_amount,
    p_ep_amount / v_ep_per_usd,
    v_processing_tier::text,
    v_reward_level,
    v_platform_fee_pct,
    v_fee_ep,
    v_fee_ep,
    v_net_ep,
    'processing',
    'bank',
    jsonb_build_object(
      'bank', v_bank,
      'account_number', v_account_number,
      'account_name', v_account_name,
      'bank_code', v_bank_code
    ),
    p_ep_amount < 10000 or p_pin is not null,
    v_ngn_rate,
    now(),
    jsonb_build_object(
      'source', 'wallet_withdrawal',
      'payout_state', 'ready',
      'paystack_reference', v_reference,
      'reward_level', v_reward_level,
      'idempotency_key', p_idempotency_key,
      'fee_pct', v_platform_fee_pct,
      'fee_ep', v_fee_ep,
      'net_ep', v_net_ep,
      'ep_per_usd', v_ep_per_usd,
      'ngn_rate', v_ngn_rate
    )
  );

  update public.wallets
  set engagement_points = v_balance_after,
      updated_at = now()
  where id = v_wallet.id;

  insert into public.wallet_history (
    wallet_id, user_id, change_type, amount, balance_before, balance_after,
    reason, transaction_id, metadata
  )
  values (
    v_wallet.id,
    v_user_id,
    'debit',
    p_ep_amount,
    v_balance_before,
    v_balance_after,
    'withdrawal:paystack_request',
    v_transaction_id,
    jsonb_build_object(
      'withdrawal_id', v_withdrawal_id,
      'currency', 'EP',
      'source', 'wallet_withdrawal',
      'fee_ep', v_fee_ep,
      'net_ep', v_net_ep
    )
  );

  insert into public.ep_transactions (
    user_id, amount, balance_after, type, reason, metadata
  )
  values (
    v_user_id,
    -p_ep_amount,
    v_balance_after,
    'spend',
    'Bank withdrawal request',
    jsonb_build_object(
      'withdrawal_id', v_withdrawal_id,
      'transaction_id', v_transaction_id,
      'currency', 'EP',
      'fee_ep', v_fee_ep,
      'net_ep', v_net_ep,
      'source', 'wallet_withdrawal'
    )
  );

  return jsonb_build_object(
    'success', true,
    'id', v_withdrawal_id,
    'transaction_id', v_transaction_id,
    'status', 'processing',
    'ep_amount', p_ep_amount,
    'fee_ep', v_fee_ep,
    'net_ep', v_net_ep,
    'net_ngn', v_net_ngn,
    'fee_pct', v_platform_fee_pct,
    'processing_tier', v_processing_tier,
    'ngn_rate', v_ngn_rate,
    'already_created', false
  );
end;
$$;

create or replace function public.settle_withdrawal_paystack_event(
  p_paystack_reference text,
  p_event_type text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_withdrawal public.withdrawal_queue%rowtype;
  v_wallet public.wallets%rowtype;
  v_amount numeric;
  v_balance_before numeric;
  v_balance_after numeric;
  v_now timestamptz := now();
  v_metadata jsonb;
begin
  if p_paystack_reference is null
     or p_event_type is null
     or p_event_type not in ('transfer.success', 'transfer.failed', 'transfer.reversed', 'initiation.failed') then
    raise exception 'Invalid Paystack withdrawal event' using errcode = '22023';
  end if;

  select *
    into v_withdrawal
  from public.withdrawal_queue
  where metadata->>'paystack_reference' = p_paystack_reference
  for update;
  if not found then
    raise exception 'Withdrawal not found for Paystack reference' using errcode = 'P0002';
  end if;

  v_metadata := coalesce(v_withdrawal.metadata, '{}'::jsonb);
  if v_metadata->>'source' is distinct from 'wallet_withdrawal' then
    raise exception 'Legacy withdrawal requires manual reconciliation' using errcode = '22023';
  end if;

  if p_event_type = 'transfer.success' then
    if v_withdrawal.status = 'completed' then
      return jsonb_build_object('success', true, 'already_settled', true);
    end if;
    if v_withdrawal.status = 'failed' and v_metadata->>'ep_refunded' = 'true' then
      return jsonb_build_object('success', true, 'ignored_stale_success', true);
    end if;
    if v_withdrawal.status <> 'processing' or v_metadata->>'ep_refunded' = 'true' then
      raise exception 'Withdrawal success conflicts with its current state' using errcode = '22023';
    end if;

    update public.withdrawal_queue
    set status = 'completed',
        processed_at = v_now,
        completed_at = v_now,
        updated_at = v_now,
        metadata = v_metadata || jsonb_build_object(
          'payout_state', 'settled',
          'paystack_event', p_event_type,
          'completed_at', v_now
        )
    where id = v_withdrawal.id;

    if v_withdrawal.transaction_id is not null then
      update public.transactions
      set status = 'completed',
          completed_at = v_now,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'paystack_event', p_event_type,
            'completed_at', v_now
          )
      where id = v_withdrawal.transaction_id;
    end if;
    return jsonb_build_object('success', true, 'already_settled', false);
  end if;

  if v_withdrawal.status = 'failed' and v_metadata->>'ep_refunded' = 'true' then
    return jsonb_build_object('success', true, 'already_refunded', true);
  end if;
  if p_event_type = 'transfer.failed' and v_withdrawal.status = 'completed' then
    return jsonb_build_object('success', true, 'ignored_stale_failure', true);
  end if;
  if p_event_type = 'initiation.failed' and v_metadata->>'payout_state' = 'submitted' then
    raise exception 'Cannot refund after Paystack accepted the transfer' using errcode = '22023';
  end if;
  if v_withdrawal.status not in ('processing', 'completed') then
    raise exception 'Withdrawal cannot be refunded from its current state' using errcode = '22023';
  end if;

  v_amount := coalesce(v_withdrawal.ep_amount, 0);
  if v_amount <= 0 then
    raise exception 'Invalid withdrawal refund amount' using errcode = '22023';
  end if;

  select *
    into v_wallet
  from public.wallets
  where user_id = v_withdrawal.user_id
  for update;
  if not found then
    raise exception 'Wallet not found for withdrawal refund' using errcode = 'P0002';
  end if;

  v_balance_before := coalesce(v_wallet.engagement_points, 0);
  v_balance_after := v_balance_before + v_amount;
  update public.wallets
  set engagement_points = v_balance_after,
      updated_at = v_now
  where id = v_wallet.id;

  insert into public.wallet_history (
    wallet_id, user_id, change_type, amount, balance_before, balance_after,
    reason, transaction_id, metadata
  )
  values (
    v_wallet.id,
    v_withdrawal.user_id,
    'credit',
    v_amount,
    v_balance_before,
    v_balance_after,
    'withdrawal:paystack_refund',
    v_withdrawal.transaction_id,
    jsonb_build_object(
      'withdrawal_id', v_withdrawal.id,
      'currency', 'EP',
      'paystack_reference', p_paystack_reference,
      'event', p_event_type,
      'reason', p_reason
    )
  );

  insert into public.ep_transactions (
    user_id, amount, balance_after, type, reason, metadata
  )
  values (
    v_withdrawal.user_id,
    v_amount,
    v_balance_after,
    'refund',
    'Bank withdrawal refund',
    jsonb_build_object(
      'withdrawal_id', v_withdrawal.id,
      'transaction_id', v_withdrawal.transaction_id,
      'currency', 'EP',
      'paystack_reference', p_paystack_reference,
      'event', p_event_type,
      'reason', p_reason,
      'source', 'wallet_withdrawal'
    )
  );

  update public.withdrawal_queue
  set status = 'failed',
      error_msg = coalesce(nullif(p_reason, ''), p_event_type),
      processed_at = v_now,
      updated_at = v_now,
      metadata = v_metadata || jsonb_build_object(
        'payout_state', 'refunded',
        'ep_refunded', true,
        'refund_amount', v_amount,
        'refund_at', v_now,
        'paystack_event', p_event_type,
        'refund_reason', p_reason
      )
  where id = v_withdrawal.id;

  if v_withdrawal.transaction_id is not null then
    update public.transactions
    set status = 'refunded',
        completed_at = v_now,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'paystack_event', p_event_type,
          'refunded_at', v_now,
          'refund_amount', v_amount,
          'refund_reason', p_reason
        )
    where id = v_withdrawal.transaction_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'already_refunded', false,
    'refund_amount', v_amount,
    'balance_after', v_balance_after
  );
end;
$$;

revoke all on function public.initiate_direct_withdrawal(uuid, bigint, jsonb, text)
  from public, anon;
grant execute on function public.initiate_direct_withdrawal(uuid, bigint, jsonb, text)
  to authenticated;

revoke all on function public.get_withdrawal_policy()
  from public, anon;
grant execute on function public.get_withdrawal_policy()
  to authenticated;

revoke all on function public.settle_withdrawal_paystack_event(text, text, text)
  from public, anon, authenticated;
grant execute on function public.settle_withdrawal_paystack_event(text, text, text)
  to service_role;
