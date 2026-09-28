create or replace function public.prevent_client_balance_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null
     and current_user in ('anon', 'authenticated')
     and public.current_admin_role() is null
     and (
       new.xev_tokens is distinct from old.xev_tokens
       or new.engagement_points is distinct from old.engagement_points
       or new.paywave_balance is distinct from old.paywave_balance
       or new.usdt_balance is distinct from old.usdt_balance
       or new.daily_withdrawal_limit is distinct from old.daily_withdrawal_limit
     ) then
    raise exception 'Wallet balances are server-authoritative';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_client_balance_mutation() from public;
grant execute on function public.prevent_client_balance_mutation() to authenticated;

create or replace function public.process_follow(p_following_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  follower uuid := auth.uid();
  current_balance numeric;
  follow_id uuid;
begin
  if follower is null or p_following_id is null or follower = p_following_id then
    return jsonb_build_object('success', false, 'error', 'Invalid follow target');
  end if;

  if exists (select 1 from public.follows where follower_id = follower and following_id = p_following_id) then
    return jsonb_build_object('success', true, 'already_following', true);
  end if;

  insert into public.wallets (user_id, xev_tokens, engagement_points, paywave_balance)
  values (follower, 0, 0, 0)
  on conflict (user_id) do nothing;

  select engagement_points into current_balance
    from public.wallets where user_id = follower for update;
  if coalesce(current_balance, 0) < 2 then
    return jsonb_build_object('success', false, 'error', 'Insufficient EP', 'required', 2, 'balance', coalesce(current_balance, 0));
  end if;

  insert into public.follows (follower_id, following_id)
  values (follower, p_following_id)
  returning id into follow_id;

  update public.wallets
    set engagement_points = engagement_points - 2, updated_at = now()
    where user_id = follower;
  current_balance := current_balance - 2;

  insert into public.ep_transactions (user_id, amount, balance_after, type, reason, metadata)
  values (follower, -2, current_balance, 'spend', 'Follow user', jsonb_build_object('engagement_type', 'follow', 'following_id', p_following_id));

  return jsonb_build_object('success', true, 'follow_id', follow_id, 'ep_cost', 2, 'balance', current_balance);
exception when unique_violation then
  return jsonb_build_object('success', true, 'already_following', true);
end;
$$;

revoke all on function public.process_follow(uuid) from public;
grant execute on function public.process_follow(uuid) to authenticated;