-- Make the welcome allocation truly once-only under concurrent initialization.

delete from public.ep_transactions older
using public.ep_transactions newer
where older.user_id = newer.user_id
  and older.type = 'bonus_grant'
  and older.metadata->>'grant' = 'welcome_10_ep'
  and newer.type = 'bonus_grant'
  and newer.metadata->>'grant' = 'welcome_10_ep'
  and older.id > newer.id;

create unique index if not exists ep_transactions_welcome_grant_uidx
  on public.ep_transactions(user_id)
  where type = 'bonus_grant' and metadata->>'grant' = 'welcome_10_ep';

create or replace function public.grant_signup_ep(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance numeric;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  insert into public.wallets (user_id, engagement_points)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  -- Serialize all initialization attempts for this account.
  select engagement_points into current_balance
    from public.wallets
    where user_id = p_user_id
    for update;

  if exists (
    select 1 from public.ep_transactions
    where user_id = p_user_id
      and type = 'bonus_grant'
      and metadata->>'grant' = 'welcome_10_ep'
  ) then
    return jsonb_build_object('success', true, 'already_granted', true, 'balance', current_balance);
  end if;

  current_balance := coalesce(current_balance, 0) + 10;
  update public.wallets
    set engagement_points = current_balance, updated_at = now()
    where user_id = p_user_id;

  insert into public.ep_transactions (user_id, amount, balance_after, type, reason, metadata)
  values (p_user_id, 10, current_balance, 'bonus_grant', 'Xeevia welcome allocation', '{"grant":"welcome_10_ep"}'::jsonb);

  return jsonb_build_object('success', true, 'granted', 10, 'balance', current_balance);
end;
$$;

revoke all on function public.grant_signup_ep(uuid) from public;
grant execute on function public.grant_signup_ep(uuid) to authenticated;