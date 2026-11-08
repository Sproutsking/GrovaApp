create or replace function public.capture_xrc_social_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  source_row jsonb;
  actor_id uuid;
  subject_id uuid;
  entity_id uuid;
  content_id uuid;
  content_type text;
  content_table text;
  content_field text;
  event_type text;
  event_data jsonb := '{}'::jsonb;
  changed_fields text[] := array[]::text[];
  source_operation text;
  idempotency_key text;
begin
  source_row := case when tg_op = 'DELETE' then old_row else new_row end;
  entity_id := nullif(source_row->>'id', '')::uuid;

  if tg_table_name = 'follows' then
    actor_id := nullif(source_row->>'follower_id', '')::uuid;
    subject_id := nullif(source_row->>'following_id', '')::uuid;
    event_type := case when tg_op = 'DELETE' then 'follow_removed' else 'follow_added' end;
    event_data := jsonb_build_object('follow_id', entity_id);
  elsif tg_table_name = 'unlocked_stories' then
    actor_id := nullif(source_row->>'user_id', '')::uuid;
    content_id := nullif(source_row->>'story_id', '')::uuid;
    select user_id into subject_id from public.stories where id = content_id;
    event_type := 'story_unlocked';
    event_data := jsonb_build_object('unlock_id', entity_id, 'story_id', content_id);
  elsif tg_table_name in ('post_likes', 'reel_likes', 'story_likes', 'comment_likes') then
    actor_id := nullif(source_row->>'user_id', '')::uuid;
    content_type := case tg_table_name
      when 'post_likes' then 'post'
      when 'reel_likes' then 'reel'
      when 'story_likes' then 'story'
      else 'comment'
    end;
    content_field := case tg_table_name
      when 'post_likes' then 'post_id'
      when 'reel_likes' then 'reel_id'
      when 'story_likes' then 'story_id'
      else 'comment_id'
    end;
    content_id := nullif(source_row->>content_field, '')::uuid;
    content_table := case content_type
      when 'post' then 'posts'
      when 'reel' then 'reels'
      when 'story' then 'stories'
      else 'comments'
    end;
    execute format('select user_id from public.%I where id = $1', content_table)
      into subject_id using content_id;
    event_type := content_type || case when tg_op = 'DELETE' then '_unliked' else '_liked' end;
    event_data := jsonb_build_object(
      'like_id', entity_id,
      'content_type', content_type,
      'content_id', content_id
    );
  elsif tg_table_name = 'comments' then
    actor_id := nullif(source_row->>'user_id', '')::uuid;
    content_type := case
      when source_row->>'post_id' is not null then 'post'
      when source_row->>'reel_id' is not null then 'reel'
      when source_row->>'story_id' is not null then 'story'
      else 'comment'
    end;
    content_id := coalesce(
      nullif(source_row->>'post_id', '')::uuid,
      nullif(source_row->>'reel_id', '')::uuid,
      nullif(source_row->>'story_id', '')::uuid,
      nullif(source_row->>'parent_id', '')::uuid
    );
    content_table := case content_type
      when 'post' then 'posts'
      when 'reel' then 'reels'
      when 'story' then 'stories'
      else 'comments'
    end;
    execute format('select user_id from public.%I where id = $1', content_table)
      into subject_id using content_id;

    if tg_op = 'INSERT' then
      event_type := case when source_row->>'parent_id' is null then 'comment_added' else 'reply_added' end;
      changed_fields := array['created'];
    elsif tg_op = 'DELETE' then
      event_type := case when source_row->>'parent_id' is null then 'comment_deleted' else 'reply_deleted' end;
      changed_fields := array['deleted'];
    else
      if old_row->>'deleted_at' is distinct from new_row->>'deleted_at' then
        event_type := case when new_row->>'deleted_at' is null then 'comment_restored' else 'comment_deleted' end;
        changed_fields := array['deleted_at'];
      elsif old_row->>'text' is distinct from new_row->>'text' then
        event_type := 'comment_edited';
        changed_fields := array['text'];
      else
        return new;
      end if;
    end if;
    event_data := jsonb_build_object(
      'comment_id', entity_id,
      'parent_comment_id', nullif(source_row->>'parent_id', '')::uuid,
      'content_type', content_type,
      'content_id', content_id,
      'changed_fields', changed_fields,
      'text_hash', encode(extensions.digest(convert_to(coalesce(source_row->>'text', ''), 'UTF8'), 'sha256'), 'hex')
    );
  elsif tg_table_name = 'shares' then
    actor_id := nullif(source_row->>'user_id', '')::uuid;
    content_type := source_row->>'content_type';
    content_id := nullif(source_row->>'content_id', '')::uuid;
    content_table := case content_type
      when 'post' then 'posts'
      when 'reel' then 'reels'
      when 'story' then 'stories'
      else null
    end;
    if content_table is not null then
      execute format('select user_id from public.%I where id = $1', content_table)
        into subject_id using content_id;
    end if;
    event_type := case when tg_op = 'DELETE' then 'content_unshared' else 'content_shared' end;
    event_data := jsonb_build_object(
      'share_id', entity_id,
      'content_type', content_type,
      'content_id', content_id,
      'share_type', source_row->>'share_type'
    );
  else
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  source_operation := tg_table_name || '.' || lower(tg_op);
  idempotency_key := 'db:' || tg_table_name || ':' || coalesce(entity_id::text, 'unknown') ||
    ':' || event_type || ':' || txid_current()::text || ':' || gen_random_uuid()::text;

  perform public.xrc_append_event_v4_internal(
    gen_random_uuid(),
    'XERC',
    actor_id,
    jsonb_build_object(
      'event', event_type,
      'entity_type', tg_table_name,
      'entity_id', entity_id,
      'subject_id', subject_id
    ) || event_data,
    idempotency_key,
    source_operation,
    1::smallint
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.capture_xrc_engagement_economy_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_type text;
  event_payload jsonb;
  idempotency_key text;
  root_table text;
  content_table text;
  subject_id uuid;
  content_owner_id uuid;
begin
  root_table := case new.root_content_type
    when 'post' then 'posts'
    when 'reel' then 'reels'
    when 'story' then 'stories'
    else null
  end;
  if root_table is not null then
    execute format('select user_id from public.%I where id = $1', root_table)
      into subject_id using new.root_content_id;
  end if;
  content_table := case new.content_type
    when 'post' then 'posts'
    when 'reel' then 'reels'
    when 'story' then 'stories'
    when 'comment' then 'comments'
    else null
  end;
  if content_table is not null then
    execute format('select user_id from public.%I where id = $1', content_table)
      into content_owner_id using new.content_id;
  end if;

  if tg_op = 'UPDATE' then
    if old.status is not distinct from new.status then return new; end if;
    event_type := 'engagement_economy_status_changed';
    event_payload := jsonb_build_object(
      'event', event_type,
      'entity_type', 'engagement_events',
      'entity_id', new.id,
      'subject_id', subject_id,
      'subject_ids', to_jsonb(array_remove(array[subject_id, content_owner_id], null)),
      'engagement_event_id', new.id,
      'status_before', old.status,
      'status_after', new.status,
      'action_type', new.action_type,
      'content_type', new.content_type,
      'content_id', new.content_id,
      'root_content_type', new.root_content_type,
      'root_content_id', new.root_content_id
    );
  else
    event_type := 'engagement_economy_recorded';
    event_payload := jsonb_build_object(
      'event', event_type,
      'entity_type', 'engagement_events',
      'entity_id', new.id,
      'subject_id', subject_id,
      'subject_ids', to_jsonb(array_remove(array[subject_id, content_owner_id], null)),
      'engagement_event_id', new.id,
      'action_type', new.action_type,
      'content_type', new.content_type,
      'content_id', new.content_id,
      'root_content_type', new.root_content_type,
      'root_content_id', new.root_content_id,
      'parent_event_id', new.parent_event_id,
      'generation', new.generation,
      'action_cost', new.action_cost,
      'protocol_fee', new.protocol_fee,
      'distributable_value', new.distributable_value,
      'rule_version', new.rule_version,
      'status', new.status
    );
  end if;

  idempotency_key := 'db:engagement_events:' || new.id::text || ':' ||
    event_type || ':' || txid_current()::text || ':' || gen_random_uuid()::text;
  perform public.xrc_append_event_v4_internal(
    gen_random_uuid(),
    'XERC',
    new.actor_id,
    event_payload,
    idempotency_key,
    'engagement_events.' || lower(tg_op),
    1::smallint
  );
  return new;
end;
$$;

create or replace function public.capture_xrc_content_view_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  content_type text := case tg_table_name
    when 'posts' then 'post'
    when 'reels' then 'reel'
    else 'story'
  end;
  actor_id uuid := auth.uid();
  event_payload jsonb;
begin
  if old.views is not distinct from new.views then return new; end if;

  event_payload := jsonb_build_object(
    'event', content_type || '_view_count_changed',
    'entity_type', tg_table_name,
    'entity_id', new.id,
    'subject_id', new.user_id,
    'content_type', content_type,
    'content_id', new.id,
    'views_before', old.views,
    'views_after', new.views,
    'view_delta', new.views - old.views
  );
  perform public.xrc_append_event_v4_internal(
    gen_random_uuid(),
    'XERC',
    actor_id,
    event_payload,
    'db:' || tg_table_name || ':' || new.id::text || ':views:' ||
      txid_current()::text || ':' || gen_random_uuid()::text,
    tg_table_name || '.views_update',
    1::smallint
  );
  return new;
end;
$$;

create or replace function public.capture_xrc_ad_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid;
  subject_id uuid;
  event_type text;
  event_payload jsonb;
  idempotency_key text;
  campaign_owner_id uuid;
begin
  if tg_table_name = 'ad_campaign_events' then
    actor_id := new.viewer_id;
    subject_id := new.creator_id;
    select owner_id into campaign_owner_id
      from public.ad_campaigns where id = new.campaign_id;
    event_type := case new.event_type
      when 'impression' then 'ad_impression_recorded'
      when 'click' then 'ad_click_recorded'
      when 'follow' then 'ad_follow_conversion_recorded'
      when 'community_join' then 'ad_community_conversion_recorded'
      else 'ad_campaign_event_recorded'
    end;
    event_payload := jsonb_build_object(
      'event', event_type,
      'entity_type', 'ad_campaign_events',
      'entity_id', new.id,
      'subject_id', subject_id,
      'subject_ids', to_jsonb(array_remove(array[subject_id, campaign_owner_id], null)),
      'campaign_id', new.campaign_id,
      'creator_id', new.creator_id,
      'event_type', new.event_type,
      'event_date', new.event_date
    );
  elsif tg_table_name = 'ad_campaign_settlements' then
    actor_id := auth.uid();
    subject_id := new.user_id;
    select owner_id into campaign_owner_id
      from public.ad_campaigns where id = new.campaign_id;
    event_type := case new.component
      when 'refund' then 'ad_campaign_refund_recorded'
      else 'ad_campaign_settlement_recorded'
    end;
    event_payload := jsonb_build_object(
      'event', event_type,
      'entity_type', 'ad_campaign_settlements',
      'entity_id', new.id,
      'subject_id', subject_id,
      'subject_ids', to_jsonb(array_remove(array[subject_id, campaign_owner_id], null)),
      'campaign_id', new.campaign_id,
      'component', new.component,
      'amount_ep', new.amount_ep,
      'event_count', new.event_count,
      'rule_version', new.rule_version
    );
  else
    return new;
  end if;

  idempotency_key := 'db:' || tg_table_name || ':' || new.id::text;
  perform public.xrc_append_event_v4_internal(
    gen_random_uuid(),
    'XTRC',
    actor_id,
    event_payload,
    idempotency_key,
    tg_table_name || '.insert',
    1::smallint
  );
  return new;
end;
$$;

revoke all on function public.capture_xrc_social_event() from public, anon, authenticated;
revoke all on function public.capture_xrc_engagement_economy_event() from public, anon, authenticated;
revoke all on function public.capture_xrc_content_view_event() from public, anon, authenticated;
revoke all on function public.capture_xrc_ad_event() from public, anon, authenticated;

drop trigger if exists xrc_capture_follows on public.follows;
create trigger xrc_capture_follows
  after insert or delete on public.follows
  for each row execute function public.capture_xrc_social_event();

drop trigger if exists xrc_capture_post_likes on public.post_likes;
create trigger xrc_capture_post_likes
  after insert or delete on public.post_likes
  for each row execute function public.capture_xrc_social_event();

drop trigger if exists xrc_capture_reel_likes on public.reel_likes;
create trigger xrc_capture_reel_likes
  after insert or delete on public.reel_likes
  for each row execute function public.capture_xrc_social_event();

drop trigger if exists xrc_capture_story_likes on public.story_likes;
create trigger xrc_capture_story_likes
  after insert or delete on public.story_likes
  for each row execute function public.capture_xrc_social_event();

drop trigger if exists xrc_capture_comment_likes on public.comment_likes;
create trigger xrc_capture_comment_likes
  after insert or delete on public.comment_likes
  for each row execute function public.capture_xrc_social_event();

drop trigger if exists xrc_capture_comments on public.comments;
create trigger xrc_capture_comments
  after insert or update or delete on public.comments
  for each row execute function public.capture_xrc_social_event();

drop trigger if exists xrc_capture_shares on public.shares;
create trigger xrc_capture_shares
  after insert or delete on public.shares
  for each row execute function public.capture_xrc_social_event();

drop trigger if exists xrc_capture_unlocked_stories on public.unlocked_stories;
create trigger xrc_capture_unlocked_stories
  after insert on public.unlocked_stories
  for each row execute function public.capture_xrc_social_event();

drop trigger if exists xrc_capture_engagement_economy on public.engagement_events;
create trigger xrc_capture_engagement_economy
  after insert or update on public.engagement_events
  for each row execute function public.capture_xrc_engagement_economy_event();

drop trigger if exists xrc_capture_post_views on public.posts;
create trigger xrc_capture_post_views
  after update of views on public.posts
  for each row execute function public.capture_xrc_content_view_event();

drop trigger if exists xrc_capture_reel_views on public.reels;
create trigger xrc_capture_reel_views
  after update of views on public.reels
  for each row execute function public.capture_xrc_content_view_event();

drop trigger if exists xrc_capture_story_views on public.stories;
create trigger xrc_capture_story_views
  after update of views on public.stories
  for each row execute function public.capture_xrc_content_view_event();

drop trigger if exists xrc_capture_ad_campaign_events on public.ad_campaign_events;
create trigger xrc_capture_ad_campaign_events
  after insert on public.ad_campaign_events
  for each row execute function public.capture_xrc_ad_event();

drop trigger if exists xrc_capture_ad_campaign_settlements on public.ad_campaign_settlements;
create trigger xrc_capture_ad_campaign_settlements
  after insert on public.ad_campaign_settlements
  for each row execute function public.capture_xrc_ad_event();
