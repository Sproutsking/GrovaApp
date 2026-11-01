create table if not exists public.ad_creator_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  topics text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint ad_creator_preferences_topics_count check (cardinality(topics) <= 12)
);
create index if not exists ad_creator_preferences_enabled_topics_gin_idx
  on public.ad_creator_preferences using gin(topics) where enabled;
create index if not exists follows_following_follower_idx
  on public.follows(following_id, follower_id);

drop policy if exists ad_campaigns_owner_update on public.ad_campaigns;

create table if not exists public.ad_creator_offers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (campaign_id, creator_id)
);

create table if not exists public.ad_campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'click', 'follow', 'community_join')),
  event_date date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);
create unique index if not exists ad_campaign_events_impression_unique
  on public.ad_campaign_events(campaign_id, creator_id, viewer_id, event_date)
  where event_type = 'impression';
create unique index if not exists ad_campaign_events_outcome_unique
  on public.ad_campaign_events(campaign_id, creator_id, viewer_id, event_type)
  where event_type <> 'impression';
create index if not exists ad_campaign_events_campaign_type_idx
  on public.ad_campaign_events(campaign_id, event_type, creator_id);
create index if not exists ad_creator_offers_creator_created_idx
  on public.ad_creator_offers(creator_id, created_at desc);
create index if not exists ad_creator_offers_campaign_status_idx
  on public.ad_creator_offers(campaign_id, status, creator_id);

create table if not exists public.ad_viewer_controls (
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  action text not null check (action in ('hidden', 'reported')),
  reason text,
  created_at timestamptz not null default now(),
  primary key (viewer_id, campaign_id)
);

create table if not exists public.ad_campaign_settlements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  user_id uuid references public.profiles(id),
  component text not null check (component in ('reach', 'outcome', 'commission', 'refund')),
  amount_ep numeric not null check (amount_ep >= 0),
  event_count integer not null default 0,
  rule_version text not null default 'creator-market-v1',
  created_at timestamptz not null default now(),
  unique (campaign_id, user_id, component)
);

alter table public.ad_creator_preferences enable row level security;
alter table public.ad_creator_offers enable row level security;
alter table public.ad_campaign_events enable row level security;
alter table public.ad_viewer_controls enable row level security;
alter table public.ad_campaign_settlements enable row level security;

drop policy if exists ad_creator_preferences_owner on public.ad_creator_preferences;
create policy ad_creator_preferences_owner on public.ad_creator_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ad_creator_offers_participant_read on public.ad_creator_offers;
create policy ad_creator_offers_participant_read on public.ad_creator_offers
  for select to authenticated using (
    creator_id = auth.uid() or exists (
      select 1 from public.ad_campaigns c where c.id = campaign_id and c.owner_id = auth.uid()
    )
  );
drop policy if exists ad_campaign_events_participant_read on public.ad_campaign_events;
drop policy if exists ad_campaign_events_viewer_read on public.ad_campaign_events;
create policy ad_campaign_events_viewer_read on public.ad_campaign_events
  for select to authenticated using (
    viewer_id = auth.uid()
  );
drop policy if exists ad_viewer_controls_owner_read on public.ad_viewer_controls;
create policy ad_viewer_controls_owner_read on public.ad_viewer_controls
  for select to authenticated using (viewer_id = auth.uid());
drop policy if exists ad_viewer_controls_admin_read on public.ad_viewer_controls;
create policy ad_viewer_controls_admin_read on public.ad_viewer_controls
  for select to authenticated using (public.current_admin_role() is not null);
revoke insert, update, delete on public.ad_viewer_controls from authenticated;
grant select on public.ad_viewer_controls to authenticated;
drop policy if exists ad_campaign_settlements_participant_read on public.ad_campaign_settlements;
create policy ad_campaign_settlements_participant_read on public.ad_campaign_settlements
  for select to authenticated using (
    user_id = auth.uid() or exists (
      select 1 from public.ad_campaigns c where c.id = campaign_id and c.owner_id = auth.uid()
    )
  );
revoke all on public.ad_creator_preferences, public.ad_creator_offers,
  public.ad_campaign_events, public.ad_viewer_controls, public.ad_campaign_settlements
  from anon;
revoke insert, update, delete on public.ad_creator_preferences, public.ad_creator_offers,
  public.ad_campaign_events, public.ad_campaign_settlements from authenticated;
grant select on public.ad_creator_preferences, public.ad_creator_offers,
  public.ad_campaign_events, public.ad_viewer_controls, public.ad_campaign_settlements
  to authenticated;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'like','comment','follow','profile_view','unlock','share','new_post','new_story',
    'new_reel','story_unlocked_by_you','milestone_followers','payment_confirmed',
    'comment_reply','mention','ad_campaign_offer'
  ])
);

create or replace function public.save_ad_creator_preferences(p_enabled boolean, p_topics text[])
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if cardinality(coalesce(p_topics, '{}')) > 12 then raise exception 'Choose no more than 12 creator topics'; end if;
  insert into public.ad_creator_preferences(user_id, enabled, topics, updated_at)
  values (v_user, coalesce(p_enabled, false), coalesce(p_topics, '{}'), now())
  on conflict (user_id) do update set enabled = excluded.enabled, topics = excluded.topics, updated_at = now();
end $$;

create or replace function public.create_ad_campaign(
  p_name text, p_objective text, p_budget_ep numeric,
  p_audience_definition jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null, p_ends_at timestamptz default null
)
returns public.ad_campaigns language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_campaign public.ad_campaigns;
  v_balance numeric;
  v_topics text[];
  v_creator_count integer;
  v_min_followers integer;
  v_fee_mode text;
  v_fee numeric;
  v_pool numeric;
  v_total_cost numeric;
  v_destination text;
  v_creative text;
  v_candidates integer;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) not between 3 and 120 then raise exception 'Campaign name must be 3–120 characters'; end if;
  if p_objective not in ('awareness', 'community_growth', 'qualified_action', 'conversion') then raise exception 'Invalid campaign objective'; end if;
  if p_budget_ep is null or p_budget_ep < 100 or p_budget_ep <> trunc(p_budget_ep) then raise exception 'Budget must be at least 100 whole EP'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= now() or p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '30 days' then raise exception 'Campaign duration must be between 1 hour and 30 days and end in the future'; end if;
  v_topics := coalesce(array(select jsonb_array_elements_text(p_audience_definition->'creator_topics')), '{}');
  if cardinality(v_topics) = 0 or cardinality(v_topics) > 12 then raise exception 'Choose 1–12 creator topics'; end if;
  v_creator_count := coalesce((p_audience_definition->>'creator_count')::integer, 1);
  v_min_followers := coalesce((p_audience_definition->>'min_followers')::integer, 0);
  v_fee_mode := coalesce(p_audience_definition->>'fee_mode', 'included');
  v_destination := trim(coalesce(p_audience_definition->>'destination_url', ''));
  v_creative := trim(coalesce(p_audience_definition->>'creative_url', ''));
  if v_creator_count not between 1 and 50 then raise exception 'Creator count must be between 1 and 50'; end if;
  if v_min_followers < 0 or v_min_followers > 10000000 then raise exception 'Invalid minimum audience size'; end if;
  if v_fee_mode not in ('included', 'on_top') then raise exception 'Invalid commission mode'; end if;
  if v_destination !~ '^https://[^[:space:]]+$' then raise exception 'Destination must be a secure HTTPS URL'; end if;
  if v_creative !~ '^https://[^[:space:]]+$' then raise exception 'Upload a campaign video before continuing'; end if;
  v_fee := case when v_fee_mode = 'included' then ceil(p_budget_ep * 0.10) else ceil(p_budget_ep * 0.10) end;
  v_pool := case when v_fee_mode = 'included' then p_budget_ep - v_fee else p_budget_ep end;
  v_total_cost := p_budget_ep + case when v_fee_mode = 'on_top' then v_fee else 0 end;
  if v_fee_mode = 'included' and v_pool <= 0 then raise exception 'Budget is too small after commission'; end if;
  if v_fee_mode = 'on_top' then v_fee := ceil(p_budget_ep * 0.10); end if;

  select count(*) into v_candidates
  from public.ad_creator_preferences pref
  join public.profiles p on p.id = pref.user_id and p.account_status = 'active' and p.deleted_at is null
  where pref.enabled and pref.user_id <> v_owner
    and (select count(*) from public.follows f where f.following_id = pref.user_id) >= v_min_followers
    and pref.topics && v_topics;
  if v_candidates = 0 then raise exception 'No opted-in creators currently match these requirements'; end if;

  insert into public.wallets(user_id, xev_tokens, engagement_points, paywave_balance)
  values(v_owner, 0, 0, 0) on conflict(user_id) do nothing;
  select * into v_wallet from public.wallets where user_id = v_owner for update;
  v_balance := coalesce(v_wallet.engagement_points, 0);
  if v_balance < v_total_cost then
    raise exception 'Insufficient EP: % available', v_balance;
  end if;

  update public.wallets set engagement_points = v_balance - v_total_cost, updated_at = now()
  where user_id = v_owner;
  insert into public.ad_campaigns(owner_id,name,objective,budget_ep,escrow_ep,status,audience_definition,starts_at,ends_at)
  values(v_owner,trim(p_name),p_objective,v_total_cost,v_total_cost,'funded',
    p_audience_definition || jsonb_build_object('creator_topics', v_topics, 'creator_count', v_creator_count,
      'min_followers', v_min_followers, 'fee_mode', v_fee_mode, 'commission_ep', v_fee, 'creator_pool_ep', v_pool),
    p_starts_at,p_ends_at) returning * into v_campaign;
  insert into public.ad_creator_offers(campaign_id,creator_id)
  select v_campaign.id,p.id
  from public.ad_creator_preferences pref
  join public.profiles p on p.id = pref.user_id and p.account_status = 'active' and p.deleted_at is null
  where pref.enabled and pref.user_id <> v_owner and pref.topics && v_topics
    and (select count(*) from public.follows f where f.following_id = pref.user_id) >= v_min_followers
  order by md5(p.id::text || v_campaign.id::text) limit v_creator_count;
  insert into public.notifications(recipient_user_id,actor_user_id,type,entity_id,message,metadata)
  select o.creator_id,v_owner,'ad_campaign_offer',v_campaign.id,
    'You are invited to review a creator campaign: ' || trim(p_name),
    jsonb_build_object('category','system','campaign_id',v_campaign.id,'url','/ads')
  from public.ad_creator_offers o where o.campaign_id = v_campaign.id;
  insert into public.ep_transactions(user_id,amount,balance_after,type,reason,metadata)
  values(v_owner,-v_total_cost,v_balance-v_total_cost,
    'spend','Creator campaign escrow',jsonb_build_object('campaign_id',v_campaign.id,'rule_version','creator-market-v1'));
  return v_campaign;
end $$;

create or replace function public.list_creator_ad_offers()
returns table(offer_id uuid,campaign_id uuid,campaign_name text,objective text,creative_url text,
  destination_url text,creator_pool_ep numeric,commission_ep numeric,fee_mode text,starts_at timestamptz,
  ends_at timestamptz,status text,owner_name text)
language sql stable security definer set search_path = public as $$
  select o.id,c.id,c.name,c.objective,c.audience_definition->>'creative_url',
    c.audience_definition->>'destination_url',(c.audience_definition->>'creator_pool_ep')::numeric,
    (c.audience_definition->>'commission_ep')::numeric,c.audience_definition->>'fee_mode',
    c.starts_at,c.ends_at,o.status,p.full_name
  from public.ad_creator_offers o join public.ad_campaigns c on c.id=o.campaign_id
  join public.profiles p on p.id=c.owner_id
  where o.creator_id=auth.uid() order by o.created_at desc
$$;

create or replace function public.respond_to_ad_offer(p_offer_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_offer public.ad_creator_offers%rowtype;
  v_campaign public.ad_campaigns%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_offer from public.ad_creator_offers where id=p_offer_id and creator_id=auth.uid() for update;
  if not found or v_offer.status <> 'pending' then raise exception 'This offer is no longer available'; end if;
  select * into v_campaign from public.ad_campaigns where id=v_offer.campaign_id for update;
  if v_campaign.status not in ('funded','active') or v_campaign.ends_at <= now() then
    raise exception 'This campaign is no longer accepting responses';
  end if;
  update public.ad_creator_offers set status=case when p_accept then 'accepted' else 'declined' end,
    responded_at=now() where id=p_offer_id;
  if p_accept then
    update public.ad_campaigns set status='active',updated_at=now()
    where id=v_offer.campaign_id and status='funded';
  end if;
end $$;

create or replace function public.get_sponsored_ads_for_feed(p_limit integer default 3)
returns table(campaign_id uuid,creator_id uuid,campaign_name text,objective text,creative_url text,
  destination_url text,creator_name text,creator_username text,advertiser_name text)
language sql stable security definer set search_path = public as $$
  select c.id,o.creator_id,c.name,c.objective,c.audience_definition->>'creative_url',
    c.audience_definition->>'destination_url',creator.full_name,creator.username,advertiser.full_name
  from public.ad_campaigns c
  join public.ad_creator_offers o on o.campaign_id=c.id and o.status='accepted'
  join public.follows f on f.following_id=o.creator_id and f.follower_id=auth.uid()
  join public.profiles creator on creator.id=o.creator_id
  join public.profiles advertiser on advertiser.id=c.owner_id
  where auth.uid() is not null and c.status='active' and c.owner_id<>auth.uid()
    and c.starts_at<=now() and c.ends_at>now()
    and not exists(select 1 from public.ad_viewer_controls x where x.viewer_id=auth.uid() and x.campaign_id=c.id and x.action='hidden')
    and not exists(select 1 from public.ad_campaign_events e where e.campaign_id=c.id and e.creator_id=o.creator_id
      and e.viewer_id=auth.uid() and e.event_type='impression' and e.event_date=(now() at time zone 'utc')::date)
  order by md5(c.id::text || auth.uid()::text || (now() at time zone 'utc')::date::text)
  limit least(greatest(coalesce(p_limit,3),0),3)
$$;

create or replace function public.record_ad_campaign_event(p_campaign_id uuid,p_creator_id uuid,p_event_type text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid:=auth.uid(); v_inserted integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_event_type not in ('impression','click') then raise exception 'Unsupported ad event'; end if;
  if not exists(select 1 from public.ad_campaigns c join public.ad_creator_offers o on o.campaign_id=c.id
    join public.follows f on f.following_id=o.creator_id and f.follower_id=v_user
    where c.id=p_campaign_id and o.creator_id=p_creator_id and o.status='accepted'
      and c.status='active' and c.starts_at<=now() and c.ends_at>now() and c.owner_id<>v_user)
  then raise exception 'Campaign is not eligible for this viewer'; end if;
  if p_event_type='click' and not exists(select 1 from public.ad_campaign_events
    where campaign_id=p_campaign_id and creator_id=p_creator_id and viewer_id=v_user and event_type='impression')
  then raise exception 'Campaign must be viewed before it can receive a click'; end if;
  insert into public.ad_campaign_events(campaign_id,creator_id,viewer_id,event_type)
  values(p_campaign_id,p_creator_id,v_user,p_event_type) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end $$;

create or replace function public.record_creator_ad_follow_conversion(p_creator_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_user uuid:=auth.uid(); v_count integer:=0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  insert into public.ad_campaign_events(campaign_id,creator_id,viewer_id,event_type)
  select distinct c.id,p_creator_id,v_user,'follow'
  from public.ad_campaigns c join public.ad_creator_offers o on o.campaign_id=c.id and o.creator_id=p_creator_id and o.status='accepted'
  join public.follows f on f.follower_id=v_user and f.following_id=p_creator_id
  where c.status='active' and c.starts_at<=now() and c.ends_at>now()
    and exists(select 1 from public.ad_campaign_events e where e.campaign_id=c.id and e.creator_id=p_creator_id
      and e.viewer_id=v_user and e.event_type='click' and f.created_at between e.created_at and e.created_at+interval '7 days')
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.set_ad_viewer_control(p_campaign_id uuid,p_action text,p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_action not in ('hidden','reported') then raise exception 'Invalid ad control'; end if;
  if p_action='reported' and nullif(trim(p_reason),'') is null then raise exception 'Please include a report reason'; end if;
  if not exists(
    select 1 from public.ad_campaigns c
    join public.ad_creator_offers o on o.campaign_id=c.id and o.status='accepted'
    join public.follows f on f.following_id=o.creator_id and f.follower_id=auth.uid()
    where c.id=p_campaign_id and c.owner_id<>auth.uid()
  ) then raise exception 'Campaign is not available to this viewer'; end if;
  insert into public.ad_viewer_controls(viewer_id,campaign_id,action,reason)
  values(auth.uid(),p_campaign_id,p_action,left(trim(p_reason),500))
  on conflict(viewer_id,campaign_id) do update set action=excluded.action,reason=excluded.reason,created_at=now();
end $$;

create or replace function public.settle_ad_campaign(p_campaign_id uuid,p_close boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_campaign public.ad_campaigns%rowtype;
  v_owner uuid:=auth.uid();
  v_fee numeric;
  v_pool numeric;
  v_reach_pool numeric;
  v_outcome_pool numeric;
  v_reach_total integer;
  v_outcome_total integer;
  v_paid numeric:=0;
  v_creator_paid numeric:=0;
  v_balance numeric;
  v_refund numeric;
  r record;
  v_reach numeric;
  v_outcome numeric;
begin
  select * into v_campaign from public.ad_campaigns where id=p_campaign_id and owner_id=v_owner for update;
  if not found then raise exception 'Campaign not found'; end if;
  if v_campaign.status='completed' then
    return jsonb_build_object('success',true,'already_settled',true);
  end if;
  if v_campaign.status not in ('active','funded','paused') then raise exception 'Campaign cannot be settled'; end if;
  if v_campaign.ends_at>now() then raise exception 'Campaign is still running'; end if;
  if v_campaign.ends_at+interval '7 days'>now() then raise exception 'The seven-day outcome attribution window is still open'; end if;
  if p_close then update public.ad_campaigns set status='completed',updated_at=now() where id=p_campaign_id; end if;
  select count(*) into v_reach_total from public.ad_campaign_events where campaign_id=p_campaign_id and event_type='impression';
  select count(*) into v_outcome_total from public.ad_campaign_events where campaign_id=p_campaign_id and event_type in ('click','follow','community_join');
  v_fee:=coalesce((v_campaign.audience_definition->>'commission_ep')::numeric,0);
  v_pool:=coalesce((v_campaign.audience_definition->>'creator_pool_ep')::numeric,0);
  v_reach_pool:=floor(v_pool*0.70);
  v_outcome_pool:=v_pool-v_reach_pool;
  if v_reach_total>0 then
    for r in select creator_id,count(*) filter(where event_type='impression')::integer reach_count,
      count(*) filter(where event_type in ('click','follow','community_join'))::integer outcome_count
      from public.ad_campaign_events where campaign_id=p_campaign_id group by creator_id
    loop
      v_reach:=case when v_reach_total>0 then floor(v_reach_pool*r.reach_count/v_reach_total*10000)/10000 else 0 end;
      v_outcome:=case when v_outcome_total>0 then floor(v_outcome_pool*r.outcome_count/v_outcome_total*10000)/10000 else 0 end;
      if v_reach+v_outcome>0 then
        insert into public.wallets(user_id,xev_tokens,engagement_points,paywave_balance)
          values(r.creator_id,0,0,0) on conflict(user_id) do nothing;
        update public.wallets set engagement_points=engagement_points+v_reach+v_outcome,updated_at=now()
          where user_id=r.creator_id returning engagement_points into v_balance;
        insert into public.ep_transactions(user_id,amount,balance_after,type,reason,metadata)
          values(r.creator_id,v_reach+v_outcome,v_balance,'bonus_grant','Creator campaign settlement',
            jsonb_build_object('campaign_id',p_campaign_id,'reach_ep',v_reach,'outcome_ep',v_outcome));
        if v_reach>0 then insert into public.ad_campaign_settlements(campaign_id,user_id,component,amount_ep,event_count)
          values(p_campaign_id,r.creator_id,'reach',v_reach,r.reach_count); end if;
        if v_outcome>0 then insert into public.ad_campaign_settlements(campaign_id,user_id,component,amount_ep,event_count)
          values(p_campaign_id,r.creator_id,'outcome',v_outcome,r.outcome_count); end if;
        v_paid:=v_paid+v_reach+v_outcome;
        v_creator_paid:=v_creator_paid+v_reach+v_outcome;
      end if;
    end loop;
  end if;
  if v_reach_total>0 and v_fee>0 then
    perform public.credit_platform_treasury_fee(v_fee,'Creator campaign commission',jsonb_build_object('campaign_id',p_campaign_id,'commission_rate',10,'rule_version','creator-market-v1'),v_owner);
    insert into public.ad_campaign_settlements(campaign_id,user_id,component,amount_ep)
      values(p_campaign_id,v_owner,'commission',v_fee);
    v_paid:=v_paid+v_fee;
  end if;
  v_refund:=greatest(v_campaign.escrow_ep-v_paid,0);
  if v_refund>0 then
    select engagement_points into v_balance from public.wallets where user_id=v_owner for update;
    update public.wallets set engagement_points=engagement_points+v_refund,updated_at=now() where user_id=v_owner returning engagement_points into v_balance;
    insert into public.ep_transactions(user_id,amount,balance_after,type,reason,metadata)
      values(v_owner,v_refund,v_balance,'refund','Unused creator campaign reserve',jsonb_build_object('campaign_id',p_campaign_id));
    insert into public.ad_campaign_settlements(campaign_id,user_id,component,amount_ep)
      values(p_campaign_id,v_owner,'refund',v_refund);
  end if;
  update public.ad_campaigns set status='completed',escrow_ep=0,updated_at=now() where id=p_campaign_id;
  return jsonb_build_object('success',true,'creator_paid_ep',v_creator_paid,'commission_ep',case when v_reach_total>0 then v_fee else 0 end,
    'refund_ep',v_refund,'impressions',v_reach_total,'outcomes',v_outcome_total);
end $$;

create or replace function public.record_creator_ad_community_conversion(p_community_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_user uuid:=auth.uid(); v_count integer:=0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  insert into public.ad_campaign_events(campaign_id,creator_id,viewer_id,event_type)
  select distinct c.id,o.creator_id,v_user,'community_join'
  from public.communities community
  join public.community_members membership on membership.community_id=community.id and membership.user_id=v_user
  join public.ad_campaigns c on c.owner_id=community.owner_id and c.objective='community_growth'
    and c.status='active' and c.starts_at<=now() and c.ends_at>now()
  join public.ad_creator_offers o on o.campaign_id=c.id and o.status='accepted'
  where community.id=p_community_id
    and exists(select 1 from public.ad_campaign_events e where e.campaign_id=c.id
      and e.creator_id=o.creator_id and e.viewer_id=v_user and e.event_type='click'
      and membership.joined_at between e.created_at and e.created_at+interval '7 days')
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.get_ad_campaign_report(p_campaign_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not exists(
    select 1 from public.ad_campaigns c where c.id=p_campaign_id and (
      c.owner_id=auth.uid() or exists(select 1 from public.ad_creator_offers o
        where o.campaign_id=c.id and o.creator_id=auth.uid() and o.status='accepted')
    )
  ) then raise exception 'Campaign report is not available'; end if;
  select jsonb_build_object(
    'accepted_creators',(select count(*) from public.ad_creator_offers where campaign_id=p_campaign_id and status='accepted'),
    'impressions',(select count(*) from public.ad_campaign_events where campaign_id=p_campaign_id and event_type='impression'),
    'clicks',(select count(*) from public.ad_campaign_events where campaign_id=p_campaign_id and event_type='click'),
    'follows',(select count(*) from public.ad_campaign_events where campaign_id=p_campaign_id and event_type='follow'),
    'community_joins',(select count(*) from public.ad_campaign_events where campaign_id=p_campaign_id and event_type='community_join'),
    'creator_paid_ep',coalesce((select sum(amount_ep) from public.ad_campaign_settlements where campaign_id=p_campaign_id and component in ('reach','outcome')),0),
    'commission_ep',coalesce((select sum(amount_ep) from public.ad_campaign_settlements where campaign_id=p_campaign_id and component='commission'),0),
    'refund_ep',coalesce((select sum(amount_ep) from public.ad_campaign_settlements where campaign_id=p_campaign_id and component='refund'),0),
    'rule_version','creator-market-v1'
  ) into v_result;
  return v_result;
end $$;

revoke all on function public.save_ad_creator_preferences(boolean,text[]) from public;
revoke all on function public.list_creator_ad_offers() from public;
revoke all on function public.respond_to_ad_offer(uuid,boolean) from public;
revoke all on function public.get_sponsored_ads_for_feed(integer) from public;
revoke all on function public.record_ad_campaign_event(uuid,uuid,text) from public;
revoke all on function public.record_creator_ad_follow_conversion(uuid) from public;
revoke all on function public.set_ad_viewer_control(uuid,text,text) from public;
revoke all on function public.settle_ad_campaign(uuid,boolean) from public;
revoke all on function public.record_creator_ad_community_conversion(uuid) from public;
revoke all on function public.get_ad_campaign_report(uuid) from public;
revoke all on function public.create_ad_campaign(text,text,numeric,jsonb,timestamptz,timestamptz) from public;
grant execute on function public.save_ad_creator_preferences(boolean,text[]) to authenticated;
grant execute on function public.list_creator_ad_offers() to authenticated;
grant execute on function public.respond_to_ad_offer(uuid,boolean) to authenticated;
grant execute on function public.get_sponsored_ads_for_feed(integer) to authenticated;
grant execute on function public.record_ad_campaign_event(uuid,uuid,text) to authenticated;
grant execute on function public.record_creator_ad_follow_conversion(uuid) to authenticated;
grant execute on function public.set_ad_viewer_control(uuid,text,text) to authenticated;
grant execute on function public.settle_ad_campaign(uuid,boolean) to authenticated;
grant execute on function public.record_creator_ad_community_conversion(uuid) to authenticated;
grant execute on function public.get_ad_campaign_report(uuid) to authenticated;
grant execute on function public.create_ad_campaign(text,text,numeric,jsonb,timestamptz,timestamptz) to authenticated;
