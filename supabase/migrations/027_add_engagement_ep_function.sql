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
  v_actor_balance numeric := 0;
  v_content_owner_id uuid := null;
  v_is_self_engagement boolean := false;
  v_platform_fee numeric := 0;
  v_distributable numeric := 0;
  v_direct_owner_share numeric := 0;
  v_post_owner_share numeric := 0;
  v_split_applied boolean := false;
  v_content_table text;
  v_owner_balance numeric := 0;
begin
  if p_actor_id is null then
    return jsonb_build_object('success', false, 'error', 'Actor ID required');
  end if;

  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  if auth.uid() <> p_actor_id then
    return jsonb_build_object('success', false, 'error', 'Authenticated actor required');
  end if;

  if p_content_type is null or p_content_id is null then
    return jsonb_build_object('success', false, 'error', 'Content reference required');
  end if;

  if p_ep_cost is null then
    return jsonb_build_object('success', false, 'error', 'EP cost required');
  end if;

  if p_ep_cost <= 0 then
    return jsonb_build_object('success', true, 'free', true, 'message', 'No EP charge required');
  end if;

  insert into public.wallets (user_id, xev_tokens, engagement_points, paywave_balance)
  values (p_actor_id, 0, 0, 0)
  on conflict (user_id) do nothing;

  select coalesce(engagement_points, 0) into v_actor_balance
  from public.wallets
  where user_id = p_actor_id
  for update;

  if coalesce(v_actor_balance, 0) < p_ep_cost then
    return jsonb_build_object(
      'success', false,
      'error', 'Insufficient EP',
      'required', p_ep_cost,
      'balance', coalesce(v_actor_balance, 0)
    );
  end if;

  case p_content_type
    when 'post' then
      v_content_table := 'posts';
    when 'reel' then
      v_content_table := 'reels';
    when 'story' then
      v_content_table := 'stories';
    when 'comment' then
      v_content_table := 'comments';
    else
      return jsonb_build_object('success', false, 'error', 'Unknown content type');
  end case;

  execute format(
    'select user_id from public.%I where id = $1',
    v_content_table
  )
  into v_content_owner_id
  using p_content_id;

  if v_content_owner_id is null then
    return jsonb_build_object('success', false, 'error', 'Content not found');
  end if;

  insert into public.wallets (user_id, xev_tokens, engagement_points, paywave_balance)
  values (v_content_owner_id, 0, 0, 0)
  on conflict (user_id) do nothing;

  v_is_self_engagement := (p_actor_id = v_content_owner_id);

  if not v_is_self_engagement then
    update public.wallets
    set engagement_points = coalesce(engagement_points, 0) - p_ep_cost,
        updated_at = now()
    where user_id = p_actor_id;

    v_actor_balance := coalesce(v_actor_balance, 0) - p_ep_cost;

    insert into public.ep_transactions (user_id, amount, balance_after, type, reason, metadata)
    values (
      p_actor_id,
      -p_ep_cost::numeric,
      v_actor_balance,
      'spend',
      'Engagement - ' || coalesce(p_engagement_type, 'engagement'),
      jsonb_build_object(
        'engagement_type', p_engagement_type,
        'content_type', p_content_type,
        'content_id', p_content_id,
        'recipient_id', v_content_owner_id
      )
    );

    v_platform_fee := (p_ep_cost * 0.15)::numeric;
    v_distributable := p_ep_cost - v_platform_fee;
    v_direct_owner_share := v_distributable;
    v_post_owner_share := 0;
    v_split_applied := false;

    update public.wallets
    set engagement_points = coalesce(engagement_points, 0) + v_direct_owner_share,
        updated_at = now()
    where user_id = v_content_owner_id;

    select coalesce(engagement_points, 0) into v_owner_balance
    from public.wallets
    where user_id = v_content_owner_id;

    insert into public.ep_transactions (user_id, amount, balance_after, type, reason, metadata)
    values (
      v_content_owner_id,
      v_direct_owner_share,
      v_owner_balance,
      'bonus_grant',
      'Creator share - ' || coalesce(p_engagement_type, 'engagement'),
      jsonb_build_object(
        'engagement_type', p_engagement_type,
        'content_type', p_content_type,
        'content_id', p_content_id,
        'actor_id', p_actor_id
      )
    );
  else
    v_platform_fee := 0;
    v_distributable := 0;
    v_direct_owner_share := 0;
    v_post_owner_share := 0;
    v_split_applied := false;
  end if;

  return jsonb_build_object(
    'success', true,
    'ep_cost', p_ep_cost,
    'balance', v_actor_balance,
    'self_engagement', v_is_self_engagement,
    'platform_fee', v_platform_fee,
    'distributable', v_distributable,
    'direct_owner_share', v_direct_owner_share,
    'post_owner_share', v_post_owner_share,
    'split_applied', v_split_applied
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