-- Xeevia Ripple Economy: canonical interaction genealogy and settlement.
-- Atomic events are the source of truth. Cumulative impact is derived and is
-- never minted as additional EP.

create table if not exists public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('post', 'reel', 'story', 'comment')),
  content_id uuid not null,
  action_type text not null check (action_type in ('like', 'comment', 'reply', 'share')),
  parent_event_id uuid references public.engagement_events(id) on delete set null,
  root_content_type text not null check (root_content_type in ('post', 'reel', 'story')),
  root_content_id uuid not null,
  generation integer not null check (generation >= 0),
  action_cost numeric not null check (action_cost >= 0),
  protocol_fee numeric not null default 0 check (protocol_fee >= 0),
  distributable_value numeric not null default 0 check (distributable_value >= 0),
  rule_version text not null default 'ripple-v1',
  status text not null default 'settled' check (status in ('settled', 'self_action', 'reversed', 'disputed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists engagement_events_root_idx
  on public.engagement_events(root_content_type, root_content_id, created_at desc);
create index if not exists engagement_events_parent_idx
  on public.engagement_events(parent_event_id, created_at desc);
create index if not exists engagement_events_actor_idx
  on public.engagement_events(actor_id, created_at desc);

create table if not exists public.engagement_event_allocations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.engagement_events(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  allocation_type text not null check (allocation_type in ('direct_contributor', 'root_creator', 'protocol_fee')),
  coefficient numeric not null check (coefficient >= 0 and coefficient <= 1),
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (event_id, recipient_id, allocation_type)
);

create index if not exists engagement_allocations_recipient_idx
  on public.engagement_event_allocations(recipient_id, created_at desc);
create index if not exists engagement_allocations_event_idx
  on public.engagement_event_allocations(event_id);

alter table public.engagement_events enable row level security;
alter table public.engagement_event_allocations enable row level security;

drop policy if exists engagement_events_owner_select on public.engagement_events;
create policy engagement_events_owner_select on public.engagement_events
  for select to authenticated using (actor_id = auth.uid());

drop policy if exists engagement_allocations_recipient_select on public.engagement_event_allocations;
create policy engagement_allocations_recipient_select on public.engagement_event_allocations
  for select to authenticated using (recipient_id = auth.uid());

create or replace function public.process_ripple_engagement(
  p_actor_id uuid,
  p_content_type text,
  p_content_id uuid,
  p_action_type text,
  p_idempotency_key text,
  p_parent_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_balance numeric := 0;
  v_content_owner uuid;
  v_root_owner uuid;
  v_root_type text;
  v_root_id uuid;
  v_parent_id uuid := p_parent_event_id;
  v_generation integer := 0;
  v_action_cost numeric;
  v_fee numeric;
  v_distributable numeric;
  v_direct numeric;
  v_root_share numeric;
  v_event public.engagement_events%rowtype;
  v_existing public.engagement_events%rowtype;
  v_table text;
  v_comment public.comments%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_actor_id then
    return jsonb_build_object('success', false, 'error', 'Authenticated actor required');
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    return jsonb_build_object('success', false, 'error', 'Idempotency key required');
  end if;
  if p_action_type not in ('like', 'comment', 'reply', 'share') then
    return jsonb_build_object('success', false, 'error', 'Unsupported engagement action');
  end if;

  select * into v_existing
  from public.engagement_events
  where idempotency_key = trim(p_idempotency_key);
  if found then
    return jsonb_build_object(
      'success', true,
      'duplicate', true,
      'event_id', v_existing.id,
      'ep_cost', v_existing.action_cost,
      'distributable', v_existing.distributable_value,
      'generation', v_existing.generation
    );
  end if;

  v_action_cost := case p_action_type
    when 'like' then 2
    when 'comment' then 4
    when 'reply' then 2
    when 'share' then 10
  end;

  if p_content_type not in ('post', 'reel', 'story', 'comment') then
    return jsonb_build_object('success', false, 'error', 'Unsupported content type');
  end if;

  if p_content_type = 'comment' then
    select * into v_comment from public.comments where id = p_content_id;
    if not found then
      return jsonb_build_object('success', false, 'error', 'Comment not found');
    end if;
    v_content_owner := v_comment.user_id;
    v_root_id := case when v_comment.post_id is not null then v_comment.post_id when v_comment.reel_id is not null then v_comment.reel_id else v_comment.story_id end;
    v_root_type := case when v_comment.post_id is not null then 'post' when v_comment.reel_id is not null then 'reel' else 'story' end;
    v_generation := 1;
    while v_comment.parent_id is not null loop
      select * into v_comment from public.comments where id = v_comment.parent_id;
      exit when not found;
      v_generation := v_generation + 1;
    end loop;
  else
    v_table := case p_content_type when 'post' then 'posts' when 'reel' then 'reels' else 'stories' end;
    execute format('select user_id from public.%I where id = $1', v_table)
      into v_content_owner using p_content_id;
    if v_content_owner is null then
      return jsonb_build_object('success', false, 'error', 'Content not found');
    end if;
    v_root_type := p_content_type;
    v_root_id := p_content_id;
    v_generation := 1;
  end if;

  if p_parent_event_id is not null then
    select generation + 1 into v_generation
    from public.engagement_events
    where id = p_parent_event_id;
    if not found then
      return jsonb_build_object('success', false, 'error', 'Parent engagement event not found');
    end if;
  end if;

  execute format('select user_id from public.%I where id = $1',
    case v_root_type when 'post' then 'posts' when 'reel' then 'reels' else 'stories' end)
    into v_root_owner using v_root_id;
  if v_root_owner is null then
    return jsonb_build_object('success', false, 'error', 'Root content not found');
  end if;

  insert into public.wallets (user_id, xev_tokens, engagement_points, paywave_balance)
  values (p_actor_id, 0, 0, 0), (v_content_owner, 0, 0, 0), (v_root_owner, 0, 0, 0)
  on conflict (user_id) do nothing;

  select coalesce(engagement_points, 0) into v_actor_balance
  from public.wallets where user_id = p_actor_id for update;
  if p_actor_id <> v_content_owner and v_actor_balance < v_action_cost then
    return jsonb_build_object('success', false, 'error', 'Insufficient EP', 'balance', v_actor_balance, 'required', v_action_cost);
  end if;

  if p_actor_id = v_content_owner then
    v_fee := 0;
    v_distributable := 0;
    insert into public.engagement_events (
      idempotency_key, actor_id, content_type, content_id, action_type,
      parent_event_id, root_content_type, root_content_id, generation,
      action_cost, protocol_fee, distributable_value, status, metadata
    ) values (
      trim(p_idempotency_key), p_actor_id, p_content_type, p_content_id, p_action_type,
      p_parent_event_id, v_root_type, v_root_id, v_generation,
      0, 0, 0, 'self_action', jsonb_build_object('rule', 'self-actions-no-settlement')
    ) returning * into v_event;
  else
    v_fee := round(v_action_cost * 0.20, 4);
    v_distributable := v_action_cost - v_fee;
    v_direct := case when v_content_owner = v_root_owner then v_distributable else round(v_distributable * 0.60, 4) end;
    v_root_share := v_distributable - v_direct;

    update public.wallets
    set engagement_points = coalesce(engagement_points, 0) - v_action_cost, updated_at = now()
    where user_id = p_actor_id;

    insert into public.engagement_events (
      idempotency_key, actor_id, content_type, content_id, action_type,
      parent_event_id, root_content_type, root_content_id, generation,
      action_cost, protocol_fee, distributable_value, metadata
    ) values (
      trim(p_idempotency_key), p_actor_id, p_content_type, p_content_id, p_action_type,
      p_parent_event_id, v_root_type, v_root_id, v_generation,
      v_action_cost, v_fee, v_distributable,
      jsonb_build_object('rule', 'ripple-v1', 'direct_recipient', v_content_owner, 'root_recipient', v_root_owner)
    ) returning * into v_event;

    update public.wallets
    set engagement_points = coalesce(engagement_points, 0) + v_direct, updated_at = now()
    where user_id = v_content_owner;
    insert into public.engagement_event_allocations (event_id, recipient_id, allocation_type, coefficient, amount)
    values (v_event.id, v_content_owner, 'direct_contributor', v_direct / nullif(v_distributable, 0), v_direct);

    if v_root_owner <> v_content_owner and v_root_share > 0 then
      update public.wallets
      set engagement_points = coalesce(engagement_points, 0) + v_root_share, updated_at = now()
      where user_id = v_root_owner;
      insert into public.engagement_event_allocations (event_id, recipient_id, allocation_type, coefficient, amount)
      values (v_event.id, v_root_owner, 'root_creator', v_root_share / nullif(v_distributable, 0), v_root_share);
    end if;

    insert into public.ep_transactions (user_id, amount, balance_after, type, reason, metadata)
    select p_actor_id, -v_action_cost, engagement_points, 'spend', 'Ripple engagement - ' || p_action_type,
      jsonb_build_object('event_id', v_event.id, 'root_content_id', v_root_id, 'generation', v_generation)
    from public.wallets where user_id = p_actor_id;

    insert into public.ep_transactions (user_id, amount, balance_after, type, reason, metadata)
    select recipient_id, amount, w.engagement_points, 'bonus_grant', 'Ripple allocation - ' || allocation_type,
      jsonb_build_object('event_id', v_event.id, 'root_content_id', v_root_id, 'generation', v_generation)
    from public.engagement_event_allocations a
    join public.wallets w on w.user_id = a.recipient_id
    where a.event_id = v_event.id;
  end if;

  return jsonb_build_object(
    'success', true,
    'event_id', v_event.id,
    'ep_cost', v_event.action_cost,
    'protocol_fee', v_event.protocol_fee,
    'distributable', v_event.distributable_value,
    'direct_owner_share', coalesce((select sum(amount) from public.engagement_event_allocations where event_id = v_event.id and allocation_type = 'direct_contributor'), 0),
    'root_owner_share', coalesce((select sum(amount) from public.engagement_event_allocations where event_id = v_event.id and allocation_type = 'root_creator'), 0),
    'split_applied', exists (select 1 from public.engagement_event_allocations where event_id = v_event.id and allocation_type = 'root_creator'),
    'generation', v_event.generation,
    'root_content_type', v_event.root_content_type,
    'root_content_id', v_event.root_content_id,
    'self_engagement', v_event.status = 'self_action'
  );
exception when others then
  return jsonb_build_object('success', false, 'error', 'Ripple settlement failed: ' || sqlerrm);
end;
$$;

revoke all on function public.process_ripple_engagement(uuid, text, uuid, text, text, uuid) from public;
grant execute on function public.process_ripple_engagement(uuid, text, uuid, text, text, uuid) to authenticated;
