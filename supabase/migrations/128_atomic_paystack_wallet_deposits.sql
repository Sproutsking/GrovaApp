create or replace function public.settle_paystack_wallet_deposit(
  p_paystack_reference text,
  p_verified_amount_kobo bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction public.transactions%rowtype;
  v_wallet public.wallets%rowtype;
  v_metadata jsonb;
  v_amount_kobo bigint;
  v_currency text;
  v_ngn_rate numeric;
  v_credit numeric;
  v_balance_before numeric;
  v_balance_after numeric;
begin
  if p_paystack_reference is null
     or length(p_paystack_reference) > 160
     or p_verified_amount_kobo is null
     or p_verified_amount_kobo <= 0 then
    raise exception 'Invalid Paystack deposit settlement data' using errcode = '22023';
  end if;

  select *
    into v_transaction
  from public.transactions
  where type = 'deposit'
    and metadata->>'paystack_ref' = p_paystack_reference
    and metadata->>'source' = 'wallet_deposit'
  for update;

  if not found or v_transaction.from_user_id is null then
    raise exception 'Pending Paystack deposit intent not found' using errcode = 'P0002';
  end if;

  if v_transaction.status = 'completed' then
    return jsonb_build_object('success', true, 'already_credited', true);
  end if;
  if v_transaction.status <> 'pending' then
    raise exception 'Paystack deposit is not pending' using errcode = '22023';
  end if;

  v_metadata := coalesce(v_transaction.metadata, '{}'::jsonb);
  begin
    v_amount_kobo := (v_metadata->>'amount_kobo')::bigint;
  exception when others then
    raise exception 'Invalid amount in Paystack deposit intent' using errcode = '22023';
  end;
  if v_amount_kobo <= 0 or abs(p_verified_amount_kobo - v_amount_kobo) > 1 then
    raise exception 'Verified Paystack amount does not match intent' using errcode = '22023';
  end if;

  v_currency := coalesce(v_metadata->>'deposit_currency', 'EP');
  if v_currency not in ('EP', 'XEV') then
    raise exception 'Unsupported wallet deposit currency' using errcode = '22023';
  end if;

  if v_metadata->>'ngn_rate_source' = 'server' then
    begin
      v_ngn_rate := (v_metadata->>'ngn_rate')::numeric;
    exception when others then
      v_ngn_rate := null;
    end;
  end if;
  if v_ngn_rate is null
     or v_ngn_rate::text in ('NaN', 'Infinity', '-Infinity')
     or v_ngn_rate < 100
     or v_ngn_rate > 1000000 then
    v_ngn_rate := 1366;
  end if;

  if v_currency = 'XEV' then
    v_credit := round((p_verified_amount_kobo::numeric / 100 / v_ngn_rate) * 10, 4);
  else
    v_credit := floor((p_verified_amount_kobo::numeric / 100 / v_ngn_rate) * 100);
  end if;
  if v_credit <= 0 then
    raise exception 'Verified deposit is too small to credit' using errcode = '22023';
  end if;

  insert into public.wallets (user_id, xev_tokens, engagement_points, paywave_balance)
  values (v_transaction.from_user_id, 0, 0, 0)
  on conflict (user_id) do nothing;

  select *
    into v_wallet
  from public.wallets
  where user_id = v_transaction.from_user_id
  for update;

  if v_currency = 'XEV' then
    v_balance_before := coalesce(v_wallet.xev_tokens, 0);
    v_balance_after := v_balance_before + v_credit;
    update public.wallets
    set xev_tokens = v_balance_after,
        updated_at = now()
    where id = v_wallet.id;
  else
    v_balance_before := coalesce(v_wallet.engagement_points, 0);
    v_balance_after := v_balance_before + v_credit;
    update public.wallets
    set engagement_points = v_balance_after,
        updated_at = now()
    where id = v_wallet.id;

    insert into public.ep_transactions (
      user_id, amount, balance_after, type, reason, metadata
    )
    values (
      v_transaction.from_user_id,
      v_credit,
      v_balance_after,
      'purchase_grant',
      'EP minted — Paystack wallet deposit',
      jsonb_build_object(
        'currency', 'EP',
        'deposit_ref', p_paystack_reference,
        'naira_paid', p_verified_amount_kobo::numeric / 100,
        'ngn_rate', v_ngn_rate,
        'source', 'wallet_deposit',
        'verified_by', 'paystack_api'
      )
    );
  end if;

  insert into public.wallet_history (
    wallet_id, user_id, change_type, amount, balance_before, balance_after,
    reason, transaction_id, metadata
  )
  values (
    v_wallet.id,
    v_transaction.from_user_id,
    'credit',
    v_credit,
    v_balance_before,
    v_balance_after,
    'deposit:paystack_webhook',
    v_transaction.id,
    jsonb_build_object(
      'currency', v_currency,
      'naira_paid', p_verified_amount_kobo::numeric / 100,
      'kobo_paid', p_verified_amount_kobo,
      'paystack_ref', p_paystack_reference,
      'source', 'wallet_deposit',
      'verified_by', 'paystack_api',
      'ngn_rate', v_ngn_rate
    )
  );

  update public.transactions
  set status = 'completed',
      completed_at = now(),
      metadata = v_metadata || jsonb_build_object(
        'currency', 'NGN',
        'verified_amount_kobo', p_verified_amount_kobo,
        'verified_amount_ngn', p_verified_amount_kobo::numeric / 100,
        'credited_amount', v_credit,
        'credited_at', now()
      )
  where id = v_transaction.id;

  return jsonb_build_object(
    'success', true,
    'already_credited', false,
    'transaction_id', v_transaction.id,
    'credited_amount', v_credit,
    'currency', v_currency,
    'balance_after', v_balance_after
  );
end;
$$;

revoke all on function public.settle_paystack_wallet_deposit(text, bigint)
  from public, anon, authenticated;
grant execute on function public.settle_paystack_wallet_deposit(text, bigint)
  to service_role;
