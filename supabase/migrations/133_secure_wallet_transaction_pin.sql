create or replace function public.wallet_pin_matches(
  p_user_id uuid,
  p_pin text,
  p_stored_hash text
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public, extensions
as $$
declare
  expected_hash text;
begin
  if p_user_id is null or p_pin is null or p_stored_hash is null then
    return false;
  end if;

  if p_stored_hash ~ '^\$2[aby]\$[0-9]{2}\$' then
    return extensions.crypt(p_pin, p_stored_hash) = p_stored_hash;
  end if;

  expected_hash := encode(
    extensions.digest(
      convert_to(p_pin || left(replace(p_user_id::text, '-', ''), 16), 'UTF8'),
      'sha256'::text
    ),
    'hex'
  );
  if expected_hash = p_stored_hash then
    return true;
  end if;

  begin
    return convert_from(decode(p_stored_hash, 'base64'), 'UTF8') = p_pin || p_user_id::text;
  exception when data_exception then
    return false;
  end;
end;
$$;

alter function public.wallet_pin_matches(uuid, text, text) owner to postgres;
revoke all on function public.wallet_pin_matches(uuid, text, text) from public, anon, authenticated;

do $$
declare
  wallet_row record;
  legacy_value text;
  legacy_pin text;
begin
  for wallet_row in
    select id, user_id, withdrawal_pin_hash
    from public.wallets
    where withdrawal_pin_hash is not null
      and withdrawal_pin_hash !~ '^[0-9a-f]{64}$'
      and length(withdrawal_pin_hash) <= 256
  loop
    begin
      legacy_value := convert_from(decode(wallet_row.withdrawal_pin_hash, 'base64'), 'UTF8');
    exception when data_exception then
      continue;
    end;

    if length(legacy_value) > 36
       and right(legacy_value, 36) = wallet_row.user_id::text then
      legacy_pin := left(legacy_value, length(legacy_value) - 36);
      if legacy_pin ~ '^[0-9]{4,12}$' then
        update public.wallets
        set withdrawal_pin_hash = encode(
              extensions.digest(
                convert_to(legacy_pin || left(replace(wallet_row.user_id::text, '-', ''), 16), 'UTF8'),
                'sha256'::text
              ),
              'hex'
            ),
            pin_length = length(legacy_pin),
            updated_at = now()
        where id = wallet_row.id
          and withdrawal_pin_hash = wallet_row.withdrawal_pin_hash;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.get_transaction_pin_status()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'has_pin', wallet.withdrawal_pin_hash is not null,
    'pin_length', coalesce(wallet.pin_length, 4),
    'locked_until', wallet.pin_locked_until
  )
  from public.wallets wallet
  where wallet.user_id = auth.uid();
$$;

alter function public.get_transaction_pin_status() owner to postgres;
revoke all on function public.get_transaction_pin_status() from public, anon;
grant execute on function public.get_transaction_pin_status() to authenticated;

create table if not exists public.transaction_pin_change_authorizations (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose = 'transaction_pin_change'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.transaction_pin_change_authorizations enable row level security;
revoke all on public.transaction_pin_change_authorizations from public, anon, authenticated;
grant all on public.transaction_pin_change_authorizations to service_role;

create table if not exists public.transaction_pin_totp_uses (
  user_id uuid not null references public.profiles(id) on delete cascade,
  time_step bigint not null,
  used_at timestamptz not null default now(),
  primary key (user_id, time_step)
);

alter table public.transaction_pin_totp_uses enable row level security;
revoke all on public.transaction_pin_totp_uses from public, anon, authenticated;
grant all on public.transaction_pin_totp_uses to service_role;

create or replace function public.consume_two_factor_backup_code(
  p_user_id uuid,
  p_code_hash text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  remaining_codes integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the authentication service may consume backup codes';
  end if;
  if p_user_id is null or p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid backup code request';
  end if;

  update public.two_factor_auth
  set backup_codes = array_remove(backup_codes, p_code_hash),
      last_used = now()
  where user_id = p_user_id
    and p_code_hash = any(backup_codes)
  returning cardinality(backup_codes) into remaining_codes;

  return remaining_codes;
end;
$$;

alter function public.consume_two_factor_backup_code(uuid, text) owner to postgres;
revoke all on function public.consume_two_factor_backup_code(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_two_factor_backup_code(uuid, text) to service_role;

drop function if exists public.set_transaction_pin(text, text, integer);
create or replace function public.set_transaction_pin(
  p_new_pin text,
  p_current_pin text,
  p_pin_length integer,
  p_authorization_token text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  wallet_row public.wallets%rowtype;
  next_attempts integer;
  lock_until timestamptz;
  authorization_id text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_authorization_token is null or p_authorization_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('success', false, 'code', 'STEP_UP_REQUIRED', 'error', 'Authenticate again before changing your transaction PIN.');
  end if;
  if p_new_pin is null or p_pin_length is null or p_pin_length not between 4 and 12
    or length(p_new_pin) <> p_pin_length or p_new_pin !~ '^[0-9]+$' then
    return jsonb_build_object('success', false, 'error', 'PIN must contain the selected number of digits.');
  end if;

  insert into public.wallets (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;
  select * into wallet_row
  from public.wallets
  where wallets.user_id = v_user_id
  for update;
  if not found then
    raise exception 'Wallet not found';
  end if;

  if wallet_row.withdrawal_pin_hash is not null then
    if wallet_row.pin_locked_until is not null and wallet_row.pin_locked_until > now() then
      return jsonb_build_object(
        'success', false,
        'error', 'PIN temporarily locked. Please try again later.',
        'locked_until', wallet_row.pin_locked_until
      );
    end if;
    if p_current_pin is null or not public.wallet_pin_matches(
      v_user_id, p_current_pin, wallet_row.withdrawal_pin_hash
    ) then
      next_attempts := coalesce(wallet_row.pin_attempts, 0) + 1;
      lock_until := case when next_attempts >= 5 then now() + interval '15 minutes' else null end;
      update public.wallets
      set pin_attempts = case when next_attempts >= 5 then 0 else next_attempts end,
          pin_locked_until = lock_until,
          updated_at = now()
      where wallets.user_id = v_user_id;
      insert into public.security_events (user_id, event_type, severity, metadata)
      values (
        v_user_id,
        'withdrawal_pin_failed',
        'warning',
        jsonb_build_object('operation', 'change_pin', 'attempts', next_attempts, 'locked_until', lock_until)
      );
      return jsonb_build_object(
        'success', false,
        'error', case when lock_until is null then 'Current PIN is incorrect.' else 'Too many incorrect attempts. PIN temporarily locked.' end,
        'locked_until', lock_until
      );
    end if;
  end if;

  update public.transaction_pin_change_authorizations
  set consumed_at = now()
  where token_hash = encode(extensions.digest(convert_to(p_authorization_token, 'UTF8'), 'sha256'), 'hex')
    and user_id = v_user_id
    and purpose = 'transaction_pin_change'
    and consumed_at is null
    and expires_at > now()
  returning token_hash into authorization_id;
  if authorization_id is null then
    return jsonb_build_object('success', false, 'code', 'STEP_UP_REQUIRED', 'error', 'Your one-time authentication expired. Verify again to continue.');
  end if;

  update public.wallets
  set withdrawal_pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)),
      pin_length = p_pin_length,
      pin_attempts = 0,
      pin_locked_until = null,
      updated_at = now()
  where wallets.user_id = v_user_id;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    v_user_id,
    'withdrawal_pin_set',
    'info',
    jsonb_build_object('pin_length', p_pin_length, 'changed', wallet_row.withdrawal_pin_hash is not null)
  );

  return jsonb_build_object('success', true, 'pin_length', p_pin_length);
end;
$$;

alter function public.set_transaction_pin(text, text, integer, text) owner to postgres;
revoke all on function public.set_transaction_pin(text, text, integer, text) from public, anon;
grant execute on function public.set_transaction_pin(text, text, integer, text) to authenticated;

create or replace function public.verify_withdrawal_pin(
  p_user_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  wallet_row public.wallets%rowtype;
  next_attempts integer;
  lock_until timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'Unauthorized';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4,12}$' then
    return jsonb_build_object('success', false, 'error', 'Invalid PIN format');
  end if;

  select * into wallet_row
  from public.wallets
  where user_id = p_user_id
  for update;
  if not found or wallet_row.withdrawal_pin_hash is null then
    return jsonb_build_object('success', false, 'error', 'No transaction PIN is set');
  end if;
  if wallet_row.pin_locked_until is not null and wallet_row.pin_locked_until > now() then
    return jsonb_build_object(
      'success', false,
      'error', 'PIN temporarily locked. Please try again later.',
      'locked_until', wallet_row.pin_locked_until
    );
  end if;

  if public.wallet_pin_matches(p_user_id, p_pin, wallet_row.withdrawal_pin_hash) then
    update public.wallets
    set withdrawal_pin_hash = case
          when wallet_row.withdrawal_pin_hash ~ '^\$2[aby]\$[0-9]{2}\$' then wallet_row.withdrawal_pin_hash
          else extensions.crypt(p_pin, extensions.gen_salt('bf', 12))
        end,
        pin_attempts = 0,
        pin_locked_until = null,
        updated_at = now()
    where user_id = p_user_id;
    return jsonb_build_object('success', true);
  end if;

  next_attempts := coalesce(wallet_row.pin_attempts, 0) + 1;
  lock_until := case when next_attempts >= 5 then now() + interval '15 minutes' else null end;
  update public.wallets
  set pin_attempts = case when next_attempts >= 5 then 0 else next_attempts end,
      pin_locked_until = lock_until,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    p_user_id,
    'withdrawal_pin_failed',
    'warning',
    jsonb_build_object('attempts', next_attempts, 'locked_until', lock_until)
  );

  return jsonb_build_object(
    'success', false,
    'error', case when lock_until is not null
      then 'Too many incorrect attempts. PIN temporarily locked.'
      else 'Incorrect PIN'
    end,
    'locked_until', lock_until
  );
end;
$$;

alter function public.verify_withdrawal_pin(uuid, text) owner to postgres;
revoke all on function public.verify_withdrawal_pin(uuid, text) from public, anon;
grant execute on function public.verify_withdrawal_pin(uuid, text) to authenticated, service_role;

create or replace function public.ep_treasury_send_to_user(
  p_recipient_id uuid,
  p_amount numeric,
  p_pin text,
  p_partition text default 'operations',
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_wallet public.wallets%rowtype;
  v_attempts integer;
  v_lock_until timestamptz;
  v_balance numeric;
  v_new_balance numeric;
  v_disbursement uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.admin_team
    where user_id = auth.uid() and role = 'ceo_owner' and status = 'active'
  ) then raise exception 'CEO authorization required'; end if;
  if p_recipient_id is null or p_amount is null or p_amount <= 0 then raise exception 'Valid recipient and amount required'; end if;
  if p_partition not in ('operations', 'growth', 'xev_rewards', 'reserve', 'unallocated') then raise exception 'Invalid treasury partition'; end if;
  if nullif(trim(coalesce(p_notes, '')), '') is null then raise exception 'Audit note is required'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,12}$' then raise exception 'Invalid security PIN'; end if;

  select * into v_wallet from public.wallets where user_id = auth.uid() for update;
  if not found or v_wallet.withdrawal_pin_hash is null then raise exception 'Set a transaction PIN before sending'; end if;
  if v_wallet.pin_locked_until is not null and v_wallet.pin_locked_until > now() then
    return jsonb_build_object('success', false, 'error', 'PIN temporarily locked', 'locked_until', v_wallet.pin_locked_until);
  end if;
  if not public.wallet_pin_matches(auth.uid(), p_pin, v_wallet.withdrawal_pin_hash) then
    v_attempts := coalesce(v_wallet.pin_attempts, 0) + 1;
    v_lock_until := case when v_attempts >= 5 then now() + interval '15 minutes' else null end;
    update public.wallets
    set pin_attempts = case when v_attempts >= 5 then 0 else v_attempts end,
        pin_locked_until = v_lock_until,
        updated_at = now()
    where user_id = auth.uid();
    insert into public.security_events (user_id, event_type, severity, metadata)
    values (
      auth.uid(),
      'withdrawal_pin_failed',
      'warning',
      jsonb_build_object('operation', 'treasury_send', 'attempts', v_attempts, 'locked_until', v_lock_until)
    );
    return jsonb_build_object(
      'success', false,
      'error', case when v_lock_until is null then 'Incorrect security PIN' else 'Too many incorrect attempts. PIN temporarily locked.' end,
      'locked_until', v_lock_until
    );
  end if;
  update public.wallets
  set withdrawal_pin_hash = case
        when v_wallet.withdrawal_pin_hash ~ '^\$2[aby]\$[0-9]{2}\$' then v_wallet.withdrawal_pin_hash
        else extensions.crypt(p_pin, extensions.gen_salt('bf', 12))
      end,
      pin_attempts = 0,
      pin_locked_until = null,
      updated_at = now()
  where user_id = auth.uid();

  if not exists (select 1 from public.profiles where id = auth.uid() and require_2fa = true) then
    raise exception 'CEO 2FA must be enabled before sending treasury funds';
  end if;
  perform 1 from public.profiles where id = p_recipient_id and account_status = 'active';
  if not found then raise exception 'Recipient is not active'; end if;
  select balance into v_balance from public.ep_treasury where partition = p_partition for update;
  if coalesce(v_balance, 0) < p_amount then raise exception 'Insufficient treasury balance'; end if;

  insert into public.wallets(user_id, xev_tokens, engagement_points, paywave_balance)
  values (p_recipient_id, 0, 0, 0) on conflict (user_id) do nothing;
  update public.ep_treasury
  set balance = balance - p_amount, total_disbursed = total_disbursed + p_amount, last_updated_at = now()
  where partition = p_partition returning balance into v_new_balance;
  update public.wallets
  set engagement_points = coalesce(engagement_points, 0) + p_amount, updated_at = now()
  where user_id = p_recipient_id;
  insert into public.ep_treasury_ledger(tx_type, partition, direction, amount, balance_after, ref_user_id, reason, metadata)
  values ('ceo_user_send', p_partition, 'debit', p_amount, v_new_balance, p_recipient_id, 'CEO treasury send',
    jsonb_build_object('admin_id', auth.uid(), 'notes', coalesce(p_notes, '')));
  insert into public.ep_treasury_disbursements(admin_id, recipient_id, partition, amount, purpose, notes)
  values (auth.uid(), p_recipient_id, p_partition, p_amount, 'user_ep_grant', coalesce(p_notes, ''))
  returning id into v_disbursement;
  insert into public.ep_transactions(user_id, amount, balance_after, type, reason, metadata)
  select p_recipient_id, p_amount, engagement_points, 'admin_grant', 'CEO treasury send',
    jsonb_build_object('disbursement_id', v_disbursement, 'partition', p_partition)
  from public.wallets where user_id = p_recipient_id;
  insert into public.security_events(user_id, event_type, severity, metadata)
  values (auth.uid(), 'ceo_treasury_send', 'critical',
    jsonb_build_object('recipient_id', p_recipient_id, 'amount', p_amount, 'partition', p_partition, 'disbursement_id', v_disbursement));
  return jsonb_build_object('success', true, 'disbursement_id', v_disbursement, 'recipient_id', p_recipient_id,
    'amount', p_amount, 'balance_after', v_new_balance);
end;
$$;

alter function public.ep_treasury_send_to_user(uuid, numeric, text, text, text) owner to postgres;
revoke all on function public.ep_treasury_send_to_user(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.ep_treasury_send_to_user(uuid, numeric, text, text, text) to authenticated;

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
    if not public.wallet_pin_matches(v_user_id, p_pin, v_wallet.withdrawal_pin_hash) then
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
    set withdrawal_pin_hash = case
          when v_wallet.withdrawal_pin_hash ~ '^\$2[aby]\$[0-9]{2}\$' then v_wallet.withdrawal_pin_hash
          else extensions.crypt(p_pin, extensions.gen_salt('bf', 12))
        end,
        pin_attempts = 0,
        pin_locked_until = null,
        updated_at = now()
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

alter function public.initiate_direct_withdrawal(uuid, bigint, jsonb, text) owner to postgres;
revoke all on function public.initiate_direct_withdrawal(uuid, bigint, jsonb, text) from public, anon;
grant execute on function public.initiate_direct_withdrawal(uuid, bigint, jsonb, text) to authenticated;

create table if not exists public.web3_payment_claims (
  chain text not null,
  tx_hash text not null,
  user_id uuid not null references public.profiles(id),
  payment_purpose text not null,
  reference_id text not null,
  created_at timestamptz not null default now(),
  primary key (chain, tx_hash)
);

insert into public.web3_payment_claims (
  chain, tx_hash, user_id, payment_purpose, reference_id
)
select
  lower(payments.metadata->>'chainType') || ':' || lower(payments.metadata->>'chain'),
  case
    when lower(payments.metadata->>'chainType') = 'solana' then payments.provider_reference
    else lower(payments.provider_reference)
  end,
  orders.user_id,
  'founders_card',
  orders.id::text
from public.founders_card_payments payments
join public.founders_card_orders orders on orders.id = payments.order_id
where payments.provider = 'web3'
  and payments.status in ('completed', 'refund_required')
  and lower(payments.metadata->>'chainType') in ('evm', 'solana', 'cardano')
  and nullif(payments.metadata->>'chain', '') is not null
on conflict (chain, tx_hash) do nothing;

insert into public.web3_payment_claims (
  chain, tx_hash, user_id, payment_purpose, reference_id
)
select
  case
    when chain_name = 'solana' then 'solana:solana'
    when chain_name = 'cardano' then 'cardano:cardano'
    else 'evm:' || chain_name
  end,
  case when chain_name = 'solana' then provider_payment_id else lower(provider_payment_id) end,
  user_id,
  'product',
  id::text
from (
  select payment_row.id, payment_row.user_id, payment_row.provider_payment_id,
    lower(coalesce(to_jsonb(payment_row)->>'chain', payment_row.metadata->>'chain')) as chain_name
  from public.payments payment_row
  where payment_row.provider = 'web3'
    and payment_row.status = 'completed'
    and payment_row.provider_payment_id is not null
) completed_web3_payments
where chain_name in ('ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'bnb', 'avalanche', 'zksync', 'fantom', 'solana', 'cardano')
on conflict (chain, tx_hash) do nothing;

alter table public.web3_payment_claims enable row level security;
revoke all on public.web3_payment_claims from public, anon, authenticated;
grant all on public.web3_payment_claims to service_role;

create or replace function public.claim_web3_payment(
  p_chain text,
  p_tx_hash text,
  p_user_id uuid,
  p_payment_purpose text,
  p_reference_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  claim_row public.web3_payment_claims%rowtype;
  normalized_chain text := lower(p_chain);
  normalized_tx_hash text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only verified payment services may claim blockchain transactions';
  end if;
  if p_chain is null or length(p_chain) = 0 or length(p_chain) > 40
    or p_tx_hash is null or length(p_tx_hash) > 128
    or p_user_id is null
    or p_payment_purpose is null or p_payment_purpose not in ('founders_card', 'product')
    or p_reference_id is null or length(p_reference_id) > 128 then
    raise exception 'Invalid blockchain payment claim';
  end if;
  normalized_tx_hash := case
    when normalized_chain like 'solana:%' then p_tx_hash
    else lower(p_tx_hash)
  end;

  insert into public.web3_payment_claims (
    chain, tx_hash, user_id, payment_purpose, reference_id
  ) values (
    normalized_chain, normalized_tx_hash, p_user_id, p_payment_purpose, p_reference_id
  )
  on conflict (chain, tx_hash) do nothing;

  if found then
    return true;
  end if;

  select * into claim_row
  from public.web3_payment_claims
  where chain = normalized_chain and tx_hash = normalized_tx_hash
  for update;
  return claim_row.user_id = p_user_id
    and claim_row.payment_purpose = p_payment_purpose
    and claim_row.reference_id = p_reference_id;
end;
$$;

alter function public.claim_web3_payment(text, text, uuid, text, text) owner to postgres;
revoke all on function public.claim_web3_payment(text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_web3_payment(text, text, uuid, text, text) to service_role;

create or replace function public.prevent_wallet_pin_client_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'INSERT' then
      if new.withdrawal_pin_hash is not null
        or coalesce(new.pin_attempts, 0) <> 0
        or new.pin_locked_until is not null then
        raise exception 'Transaction PIN fields can only be changed through the secure PIN routines';
      end if;
    elsif new.withdrawal_pin_hash is distinct from old.withdrawal_pin_hash
      or new.pin_length is distinct from old.pin_length
      or new.pin_attempts is distinct from old.pin_attempts
      or new.pin_locked_until is distinct from old.pin_locked_until then
      raise exception 'Transaction PIN fields can only be changed through the secure PIN routines';
    end if;
  end if;
  return new;
end;
$$;

alter function public.prevent_wallet_pin_client_mutation() owner to postgres;
revoke all on function public.prevent_wallet_pin_client_mutation() from public, anon, authenticated;

drop trigger if exists wallet_pin_fields_guard on public.wallets;
create trigger wallet_pin_fields_guard
before insert or update on public.wallets
for each row execute function public.prevent_wallet_pin_client_mutation();

revoke select on public.wallets from public, anon, authenticated;
grant select (
  id,
  user_id,
  xev_tokens,
  engagement_points,
  created_at,
  updated_at,
  daily_withdrawal_limit,
  paywave_balance,
  usdt_balance
) on public.wallets to authenticated;
