-- Add process_engagement_ep RPC function for like/comment/share engagements
-- This function deducts EP from the actor and distributes creator rewards

create or replace function public.process_engagement_ep(
  p_actor_id uuid,
  p_content_type text,
  p_content_id uuid,
  p_engagement_type text,
  p_ep_cost integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_balance numeric;
  content_owner_id uuid;
  is_self_engagement boolean;
  platform_fee numeric;
  distributable numeric;
  direct_owner_share numeric;
  post_owner_share numeric;
  split_applied boolean;
  engagement_record record;
begin
  -- Validate inputs
  if p_actor_id is null then
    return jsonb_build_object('success', false, 'error', 'Actor ID required');
  end if;

  if auth.uid() is null or auth.uid() <> p_actor_id then
    return jsonb_build_object('success', false, 'error', 'Authenticated actor required');
  end if;
  
  if p_ep_cost <= 0 then
    return jsonb_build_object('success', true, 'free', true);
  end if;

  insert into public.wallets (user_id, xev_tokens, engagement_points, paywave_balance)
  values (p_actor_id, 0, 0, 0)
  on conflict (user_id) do nothing;

  -- Get actor's current balance
  select engagement_points into actor_balance
    from public.wallets where user_id = p_actor_id for update;
  
  if coalesce(actor_balance, 0) < p_ep_cost then
    return jsonb_build_object(
      'success', false,
      'error', 'Insufficient EP',
      'required', p_ep_cost,
      'balance', coalesce(actor_balance, 0)
    );
  end if;

  -- Get content owner based on content type
  case p_content_type
    when 'post' then
      select user_id into content_owner_id from public.posts where id = p_content_id;
    when 'reel' then
      select user_id into content_owner_id from public.reels where id = p_content_id;
    when 'story' then
      select user_id into content_owner_id from public.stories where id = p_content_id;
    when 'comment' then
      select user_id into content_owner_id from public.comments where id = p_content_id;
    else
      return jsonb_build_object('success', false, 'error', 'Unknown content type');
  end case;

  if content_owner_id is null then
    return jsonb_build_object('success', false, 'error', 'Content not found');
  end if;

  insert into public.wallets (user_id, xev_tokens, engagement_points, paywave_balance)
  values (content_owner_id, 0, 0, 0)
  on conflict (user_id) do nothing;

  is_self_engagement := (p_actor_id = content_owner_id);

  -- Deduct EP from actor (unless self-engagement)
  if not is_self_engagement then
    update public.wallets
      set engagement_points = engagement_points - p_ep_cost,
          updated_at = now()
      where user_id = p_actor_id;

    actor_balance := actor_balance - p_ep_cost;

    -- Record transaction for actor
    insert into public.ep_transactions (user_id, amount, balance_after, type, reason, metadata)
    values (
      p_actor_id,
      -p_ep_cost,
      actor_balance,
      'spend',
      'Engagement - ' || p_engagement_type,
      jsonb_build_object(
        'engagement_type', p_engagement_type,
        'content_type', p_content_type,
        'content_id', p_content_id,
        'recipient_id', content_owner_id
      )
    );

    -- Award creator (platform fee: 15%, distributable: 85%)
    platform_fee := (p_ep_cost * 0.15)::numeric;
    distributable := p_ep_cost - platform_fee;
    direct_owner_share := distributable;
    post_owner_share := 0;
    split_applied := false;

    -- Award to content owner
    update public.wallets
      set engagement_points = coalesce(engagement_points, 0) + direct_owner_share,
          updated_at = now()
      where user_id = content_owner_id;

    -- Record transaction for owner
    insert into public.ep_transactions (user_id, amount, balance_after, type, reason, metadata)
    values (
      content_owner_id,
      direct_owner_share::integer,
      (select coalesce(engagement_points, 0) from public.wallets where user_id = content_owner_id),
      'bonus_grant',
      'Creator share - ' || p_engagement_type,
      jsonb_build_object(
        'engagement_type', p_engagement_type,
        'content_type', p_content_type,
        'content_id', p_content_id,
        'actor_id', p_actor_id
      )
    );
  else
    platform_fee := 0;
    distributable := 0;
    direct_owner_share := 0;
    post_owner_share := 0;
    split_applied := false;
  end if;

  return jsonb_build_object(
    'success', true,
    'ep_cost', p_ep_cost,
    'balance', actor_balance,
    'self_engagement', is_self_engagement,
    'platform_fee', platform_fee,
    'distributable', distributable,
    'direct_owner_share', direct_owner_share,
    'post_owner_share', post_owner_share,
    'split_applied', split_applied
  );

exception when others then
  return jsonb_build_object(
    'success', false,
    'error', 'EP processing failed: ' || sqlerrm
  );
end;
$$;

revoke all on function public.process_engagement_ep(uuid, text, uuid, text, integer) from public;
grant execute on function public.process_engagement_ep(uuid, text, uuid, text, integer) to authenticated;

-- Ensure increment_likes function exists for like count tracking
create or replace function public.increment_likes(table_name text, content_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  case table_name
    when 'posts' then
      update public.posts set likes = coalesce(likes, 0) + 1 where id = content_id;
    when 'reels' then
      update public.reels set likes = coalesce(likes, 0) + 1 where id = content_id;
    when 'stories' then
      update public.stories set likes = coalesce(likes, 0) + 1 where id = content_id;
    when 'comments' then
      update public.comments set likes = coalesce(likes, 0) + 1 where id = content_id;
    else
      raise exception 'Unknown table: %', table_name;
  end case;
exception when others then
  raise warning 'increment_likes failed for table %: %', table_name, sqlerrm;
end;
$$;

create or replace function public.decrement_likes(table_name text, content_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  case table_name
    when 'posts' then
      update public.posts set likes = greatest(0, coalesce(likes, 1) - 1) where id = content_id;
    when 'reels' then
      update public.reels set likes = greatest(0, coalesce(likes, 1) - 1) where id = content_id;
    when 'stories' then
      update public.stories set likes = greatest(0, coalesce(likes, 1) - 1) where id = content_id;
    when 'comments' then
      update public.comments set likes = greatest(0, coalesce(likes, 1) - 1) where id = content_id;
    else
      raise exception 'Unknown table: %', table_name;
  end case;
exception when others then
  raise warning 'decrement_likes failed for table %: %', table_name, sqlerrm;
end;
$$;

revoke all on function public.increment_likes(text, uuid) from public;
grant execute on function public.increment_likes(text, uuid) to authenticated;
revoke all on function public.decrement_likes(text, uuid) from public;
grant execute on function public.decrement_likes(text, uuid) to authenticated;
