-- Transaction PIN verification
-- Matches PinSetupModal.hashPin: SHA-256(pin + first 16 hex chars of user id).
create extension if not exists pgcrypto with schema extensions;

create or replace function public.verify_withdrawal_pin(
  p_user_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  wallet_row public.wallets%rowtype;
  expected_hash text;
  next_attempts integer;
  lock_until timestamptz;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Unauthorized';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4,12}$' then
    return jsonb_build_object('success', false, 'error', 'Invalid PIN format');
  end if;

  select * into wallet_row
  from public.wallets
  where user_id = p_user_id
  for update;

  if wallet_row.user_id is null or wallet_row.withdrawal_pin_hash is null then
    return jsonb_build_object('success', false, 'error', 'No transaction PIN is set');
  end if;

  if wallet_row.pin_locked_until is not null and wallet_row.pin_locked_until > now() then
    return jsonb_build_object(
      'success', false,
      'error', 'PIN temporarily locked. Please try again later.',
      'locked_until', wallet_row.pin_locked_until
    );
  end if;

  expected_hash := encode(
    extensions.digest(
      convert_to(p_pin || left(replace(p_user_id::text, '-', ''), 16), 'UTF8'),
      'sha256'::text
    ),
    'hex'
  );

  if expected_hash = wallet_row.withdrawal_pin_hash then
    update public.wallets
    set pin_attempts = 0,
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
revoke all on function public.verify_withdrawal_pin(uuid, text) from public;
grant execute on function public.verify_withdrawal_pin(uuid, text) to authenticated;
