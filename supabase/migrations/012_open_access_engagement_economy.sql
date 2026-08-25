-- Xeevia is open to authenticated users. Engagement capacity remains server-authoritative.

delete from public.follows older
using public.follows newer
where older.follower_id = newer.follower_id
  and older.following_id = newer.following_id
  and older.id > newer.id;

create unique index if not exists follows_follower_following_uidx
  on public.follows(follower_id, following_id);

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

  if exists (
    select 1 from public.ep_transactions
    where user_id = p_user_id
      and type = 'bonus_grant'
      and metadata->>'grant' = 'welcome_10_ep'
  ) then
    select engagement_points into current_balance from public.wallets where user_id = p_user_id;
    return jsonb_build_object('success', true, 'already_granted', true, 'balance', current_balance);
  end if;

  update public.wallets
    set engagement_points = coalesce(engagement_points, 0) + 10,
        updated_at = now()
    where user_id = p_user_id
    returning engagement_points into current_balance;

  insert into public.ep_transactions (user_id, amount, balance_after, type, reason, metadata)
  values (p_user_id, 10, current_balance, 'bonus_grant', 'Xeevia welcome allocation', '{"grant":"welcome_10_ep"}'::jsonb);

  return jsonb_build_object('success', true, 'granted', 10, 'balance', current_balance);
end;
$$;

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

revoke all on function public.grant_signup_ep(uuid) from public;
grant execute on function public.grant_signup_ep(uuid) to authenticated;
revoke all on function public.process_follow(uuid) from public;
grant execute on function public.process_follow(uuid) to authenticated;