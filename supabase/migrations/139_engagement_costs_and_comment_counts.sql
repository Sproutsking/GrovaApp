-- Align share/save pricing across clients and enforce settlement at the
-- database boundary. Comment counters are derived from active top-level rows.

alter table public.engagement_events
  drop constraint if exists engagement_events_action_type_check;

alter table public.engagement_events
  add constraint engagement_events_action_type_check
  check (action_type in ('like', 'comment', 'reply', 'share', 'save'));

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
set search_path = public, pg_temp
as $$
declare
  v_actor_balance numeric := 0;
  v_content_owner uuid;
  v_root_owner uuid;
  v_root_type text;
  v_root_id uuid;
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
  if p_action_type not in ('like', 'comment', 'reply', 'share', 'save') then
    return jsonb_build_object('success', false, 'error', 'Unsupported engagement action');
  end if;

  select * into v_existing
  from public.engagement_events
  where idempotency_key = trim(p_idempotency_key);
  if found then
    if v_existing.actor_id <> p_actor_id
      or v_existing.content_type <> p_content_type
      or v_existing.content_id <> p_content_id
      or v_existing.action_type <> p_action_type then
      return jsonb_build_object('success', false, 'error', 'Idempotency key already used');
    end if;
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
    when 'share' then 1
    when 'save' then 1
  end;

  if p_content_type not in ('post', 'reel', 'story', 'comment')
    or (p_action_type = 'save' and p_content_type = 'comment') then
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
      jsonb_build_object('rule', 'ripple-v2', 'direct_recipient', v_content_owner, 'root_recipient', v_root_owner)
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

with ranked_saves as (
  select id,
    row_number() over (
      partition by user_id, content_type, content_id, coalesce(folder, 'Favorites')
      order by created_at nulls last, id
    ) as row_number
  from public.saved_content
)
delete from public.saved_content saved
using ranked_saves ranked
where saved.id = ranked.id and ranked.row_number > 1;

update public.saved_content set folder = 'Favorites' where folder is null;
alter table public.saved_content alter column folder set not null;
create unique index if not exists saved_content_user_item_folder_unique
  on public.saved_content(user_id, content_type, content_id, folder);

create or replace function public.settle_saved_content_ep()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or auth.uid() <> new.user_id then
    raise exception 'Authenticated owner required to save content';
  end if;

  v_result := public.process_ripple_engagement(
    new.user_id,
    new.content_type,
    new.content_id,
    'save',
    'save:' || new.id::text,
    null
  );

  if coalesce((v_result ->> 'success')::boolean, false) is not true then
    raise exception '%', coalesce(v_result ->> 'error', 'Save settlement failed');
  end if;
  return new;
end;
$$;

revoke all on function public.settle_saved_content_ep() from public;
drop trigger if exists saved_content_settle_ep on public.saved_content;
create trigger saved_content_settle_ep
  after insert on public.saved_content
  for each row execute function public.settle_saved_content_ep();

create table if not exists public.news_share_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  news_id uuid not null references public.news_posts(id) on delete cascade,
  idempotency_key text not null unique,
  ep_cost numeric not null default 1 check (ep_cost = 1),
  created_at timestamptz not null default now()
);

alter table public.news_share_events enable row level security;
drop policy if exists news_share_events_owner_select on public.news_share_events;
create policy news_share_events_owner_select on public.news_share_events
  for select to authenticated using (actor_id = auth.uid());
revoke all on public.news_share_events from public, anon, authenticated;
grant select on public.news_share_events to authenticated;

create or replace function public.process_news_share(
  p_actor_id uuid,
  p_news_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance numeric := 0;
  v_existing public.news_share_events%rowtype;
  v_event public.news_share_events%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_actor_id then
    return jsonb_build_object('success', false, 'error', 'Authenticated actor required');
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    return jsonb_build_object('success', false, 'error', 'Idempotency key required');
  end if;
  if not exists (select 1 from public.news_posts where id = p_news_id and is_active) then
    return jsonb_build_object('success', false, 'error', 'News item not found');
  end if;

  insert into public.wallets (user_id, xev_tokens, engagement_points, paywave_balance)
  values (p_actor_id, 0, 0, 0)
  on conflict (user_id) do nothing;
  select coalesce(engagement_points, 0) into v_balance
  from public.wallets where user_id = p_actor_id for update;

  select * into v_existing
  from public.news_share_events
  where idempotency_key = trim(p_idempotency_key);
  if found then
    if v_existing.actor_id <> p_actor_id or v_existing.news_id <> p_news_id then
      return jsonb_build_object('success', false, 'error', 'Idempotency key already used');
    end if;
    return jsonb_build_object('success', true, 'duplicate', true, 'ep_cost', v_existing.ep_cost);
  end if;

  if v_balance < 1 then
    return jsonb_build_object('success', false, 'error', 'Insufficient EP', 'balance', v_balance, 'required', 1);
  end if;

  update public.wallets
  set engagement_points = coalesce(engagement_points, 0) - 1, updated_at = now()
  where user_id = p_actor_id;

  insert into public.news_share_events (actor_id, news_id, idempotency_key, ep_cost)
  values (p_actor_id, p_news_id, trim(p_idempotency_key), 1)
  returning * into v_event;

  insert into public.ep_transactions (user_id, amount, balance_after, type, reason, metadata)
  select p_actor_id, -1, engagement_points, 'spend', 'News share',
    jsonb_build_object('news_id', p_news_id, 'event_id', v_event.id)
  from public.wallets where user_id = p_actor_id;

  return jsonb_build_object('success', true, 'event_id', v_event.id, 'ep_cost', 1);
exception when others then
  return jsonb_build_object('success', false, 'error', 'News share settlement failed: ' || sqlerrm);
end;
$$;

revoke all on function public.process_news_share(uuid, uuid, text) from public;
grant execute on function public.process_news_share(uuid, uuid, text) to authenticated;

create or replace function public.sync_content_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_type text;
  v_old_id uuid;
  v_old_counted boolean := false;
  v_new_type text;
  v_new_id uuid;
  v_new_counted boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_type := case when old.post_id is not null then 'post' when old.reel_id is not null then 'reel' when old.story_id is not null then 'story' end;
    v_old_id := coalesce(old.post_id, old.reel_id, old.story_id);
    v_old_counted := old.parent_id is null and old.deleted_at is null and v_old_id is not null;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_type := case when new.post_id is not null then 'post' when new.reel_id is not null then 'reel' when new.story_id is not null then 'story' end;
    v_new_id := coalesce(new.post_id, new.reel_id, new.story_id);
    v_new_counted := new.parent_id is null and new.deleted_at is null and v_new_id is not null;
  end if;

  if v_old_counted and (
    not v_new_counted
    or v_old_type is distinct from v_new_type
    or v_old_id is distinct from v_new_id
  ) then
    if v_old_type = 'post' then
      update public.posts set comments_count = greatest(coalesce(comments_count, 0) - 1, 0) where id = v_old_id;
    elsif v_old_type = 'reel' then
      update public.reels set comments_count = greatest(coalesce(comments_count, 0) - 1, 0) where id = v_old_id;
    elsif v_old_type = 'story' then
      update public.stories set comments_count = greatest(coalesce(comments_count, 0) - 1, 0) where id = v_old_id;
    end if;
  end if;

  if v_new_counted and (
    not v_old_counted
    or v_old_type is distinct from v_new_type
    or v_old_id is distinct from v_new_id
  ) then
    if v_new_type = 'post' then
      update public.posts set comments_count = coalesce(comments_count, 0) + 1 where id = v_new_id;
    elsif v_new_type = 'reel' then
      update public.reels set comments_count = coalesce(comments_count, 0) + 1 where id = v_new_id;
    elsif v_new_type = 'story' then
      update public.stories set comments_count = coalesce(comments_count, 0) + 1 where id = v_new_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_content_comments_count() from public;
drop trigger if exists comments_sync_content_count on public.comments;
create trigger comments_sync_content_count
  after insert or delete
  on public.comments
  for each row execute function public.sync_content_comments_count();

drop trigger if exists comments_sync_content_count_update on public.comments;
create trigger comments_sync_content_count_update
  after update of post_id, reel_id, story_id, parent_id, deleted_at
  on public.comments
  for each row execute function public.sync_content_comments_count();

update public.posts p
set comments_count = (
  select count(*)::integer
  from public.comments c
  where c.post_id = p.id and c.parent_id is null and c.deleted_at is null
);
update public.reels r
set comments_count = (
  select count(*)::integer
  from public.comments c
  where c.reel_id = r.id and c.parent_id is null and c.deleted_at is null
);
update public.stories s
set comments_count = (
  select count(*)::integer
  from public.comments c
  where c.story_id = s.id and c.parent_id is null and c.deleted_at is null
);
