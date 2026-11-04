create table if not exists public.community_premium_platform_config (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  trial_days integer not null default 90 check (trial_days between 1 and 365),
  reminder_days integer not null default 7 check (reminder_days between 1 and 90),
  plans jsonb not null default '{
    "free": {"members": 100, "custom_channels": 9, "open_tickets": 25, "social_updates": false, "social_connections": 0, "monthly_price_usd": 0},
    "premium": {"members": 1000, "custom_channels": 50, "open_tickets": 100, "social_updates": true, "social_connections": 3, "monthly_price_usd": 0},
    "premium_plus": {"members": 10000, "custom_channels": 250, "open_tickets": 500, "social_updates": true, "social_connections": 10, "monthly_price_usd": 0}
  }'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.community_premium_platform_config (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.community_premium_entitlements (
  community_id uuid primary key references public.communities(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'premium', 'premium_plus')),
  trial_started_at timestamptz,
  trial_expires_at timestamptz,
  access_until timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.community_premium_platform_config enable row level security;
alter table public.community_premium_entitlements enable row level security;
revoke all on public.community_premium_platform_config from anon, authenticated;
revoke all on public.community_premium_entitlements from anon, authenticated;

insert into public.community_premium_entitlements (
  community_id, tier, trial_started_at, trial_expires_at
)
select c.id, 'free', now(), now() + interval '90 days'
from public.communities c
on conflict (community_id) do nothing;

create or replace function public.get_community_premium_access(p_community_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  platform_config public.community_premium_platform_config;
  entitlement public.community_premium_entitlements;
  effective_tier text := 'free';
  effective_limits jsonb;
  active_trial boolean := false;
begin
  select * into platform_config
  from public.community_premium_platform_config
  where id = true;

  if not found then
    raise exception 'Community Premium configuration is missing';
  end if;

  select * into entitlement
  from public.community_premium_entitlements
  where community_id = p_community_id;

  if platform_config.enabled and found then
    if entitlement.tier in ('premium', 'premium_plus')
      and (entitlement.access_until is null or entitlement.access_until > now()) then
      effective_tier := entitlement.tier;
    elsif entitlement.trial_expires_at > now() then
      effective_tier := 'premium_plus';
      active_trial := true;
    end if;
  end if;

  effective_limits := platform_config.plans -> effective_tier;
  if effective_limits is null then
    raise exception 'Community Premium plan configuration for % is missing', effective_tier;
  end if;

  return jsonb_build_object(
    'premium_enabled', platform_config.enabled,
    'tier', effective_tier,
    'limits', effective_limits,
    'is_trial', active_trial,
    'trial_expires_at', entitlement.trial_expires_at,
    'access_until', entitlement.access_until,
    'trial_reminder_days', platform_config.reminder_days
  );
end;
$$;

alter function public.get_community_premium_access(uuid) owner to postgres;
revoke all on function public.get_community_premium_access(uuid) from public, anon;
grant execute on function public.get_community_premium_access(uuid) to authenticated, service_role;

create or replace function public.get_community_custom_channel_capacity(p_community_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  policy jsonb;
  channel_limit integer;
  current_channels integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.community_members
    where community_id = p_community_id and user_id = auth.uid()
  ) then
    raise exception 'You are not a member of this community';
  end if;

  policy := public.get_community_premium_access(p_community_id);
  channel_limit := (policy #>> '{limits,custom_channels}')::integer;
  select count(*) into current_channels
  from public.community_channels
  where community_id = p_community_id
    and not is_default
    and coalesce(integrations ->> 'ticket', 'false') <> 'true'
    and deleted_at is null;

  return jsonb_build_object(
    'tier', policy ->> 'tier',
    'limit', channel_limit,
    'remaining', greatest(channel_limit - current_channels, 0)
  );
end;
$$;

alter function public.get_community_custom_channel_capacity(uuid) owner to postgres;
revoke all on function public.get_community_custom_channel_capacity(uuid) from public, anon;
grant execute on function public.get_community_custom_channel_capacity(uuid) to authenticated;

create or replace function public.initialize_community_premium_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trial_duration integer;
begin
  select trial_days into trial_duration
  from public.community_premium_platform_config
  where id = true;

  insert into public.community_premium_entitlements (
    community_id, tier, trial_started_at, trial_expires_at
  ) values (
    new.id, 'free', now(), now() + make_interval(days => coalesce(trial_duration, 90))
  ) on conflict (community_id) do nothing;

  return new;
end;
$$;

alter function public.initialize_community_premium_trial() owner to postgres;
revoke all on function public.initialize_community_premium_trial() from public, anon, authenticated;

drop trigger if exists community_premium_trial_on_create on public.communities;
create trigger community_premium_trial_on_create
after insert on public.communities
for each row execute function public.initialize_community_premium_trial();

create or replace function public.admin_get_community_premium_config(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  platform_config public.community_premium_platform_config;
  communities jsonb;
begin
  if not exists (
    select 1 from public.admin_team
    where user_id = auth.uid() and role = 'ceo_owner' and status = 'active'
  ) then
    raise exception 'Only the CEO can manage Community Premium';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid pagination values';
  end if;

  select * into platform_config
  from public.community_premium_platform_config
  where id = true;

  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.created_at desc), '[]'::jsonb)
  into communities
  from (
    select c.id, c.name, c.member_count, c.created_at,
      e.tier, e.trial_started_at, e.trial_expires_at, e.access_until
    from public.communities c
    left join public.community_premium_entitlements e on e.community_id = c.id
    where c.deleted_at is null
      and (
        nullif(trim(p_search), '') is null
        or c.name ilike '%' || trim(p_search) || '%'
        or c.id::text ilike '%' || trim(p_search) || '%'
      )
    order by c.created_at desc
    limit p_limit offset p_offset
  ) page_row;

  return jsonb_build_object(
    'enabled', platform_config.enabled,
    'trial_days', platform_config.trial_days,
    'reminder_days', platform_config.reminder_days,
    'plans', platform_config.plans,
    'communities', communities
  );
end;
$$;

alter function public.admin_get_community_premium_config(text, integer, integer) owner to postgres;
revoke all on function public.admin_get_community_premium_config(text, integer, integer) from public, anon;
grant execute on function public.admin_get_community_premium_config(text, integer, integer) to authenticated;

create or replace function public.admin_update_community_premium_config(
  p_enabled boolean,
  p_trial_days integer,
  p_reminder_days integer,
  p_plans jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_name text;
  plan_data jsonb;
  numeric_key text;
  numeric_value text;
begin
  if not exists (
    select 1 from public.admin_team
    where user_id = auth.uid() and role = 'ceo_owner' and status = 'active'
  ) then
    raise exception 'Only the CEO can manage Community Premium';
  end if;

  if p_enabled is null or p_trial_days is null or p_trial_days not between 1 and 365
    or p_reminder_days is null or p_reminder_days not between 1 and 90
    or p_reminder_days >= p_trial_days then
    raise exception 'Premium settings are outside supported ranges';
  end if;

  if jsonb_typeof(p_plans) is distinct from 'object'
    or jsonb_typeof(p_plans -> 'free') is distinct from 'object'
    or jsonb_typeof(p_plans -> 'premium') is distinct from 'object'
    or jsonb_typeof(p_plans -> 'premium_plus') is distinct from 'object' then
    raise exception 'All three plan definitions are required';
  end if;

  foreach plan_name in array array['free', 'premium', 'premium_plus'] loop
    plan_data := p_plans -> plan_name;
    foreach numeric_key in array array['members', 'custom_channels', 'open_tickets', 'social_connections'] loop
      numeric_value := plan_data ->> numeric_key;
      if numeric_value is null or numeric_value !~ '^[0-9]+$'
        or numeric_value::bigint > (case numeric_key
          when 'members' then 10000000
          when 'custom_channels' then 1000
          when 'open_tickets' then 10000
          else 1000
        end)
        or (numeric_key = 'members' and numeric_value::bigint < 1) then
        raise exception 'Invalid % limit for the % plan', numeric_key, plan_name;
      end if;
    end loop;

    if jsonb_typeof(plan_data -> 'social_updates') is distinct from 'boolean'
      or plan_data ->> 'monthly_price_usd' is null
      or (plan_data ->> 'monthly_price_usd') !~ '^[0-9]+([.][0-9]{1,2})?$'
      or (plan_data ->> 'monthly_price_usd')::numeric > 100000 then
      raise exception 'Invalid social-update or monthly price setting for the % plan', plan_name;
    end if;
  end loop;

  update public.community_premium_platform_config
  set enabled = p_enabled,
      trial_days = p_trial_days,
      reminder_days = p_reminder_days,
      plans = p_plans,
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;
end;
$$;

alter function public.admin_update_community_premium_config(boolean, integer, integer, jsonb) owner to postgres;
revoke all on function public.admin_update_community_premium_config(boolean, integer, integer, jsonb) from public, anon;
grant execute on function public.admin_update_community_premium_config(boolean, integer, integer, jsonb) to authenticated;

create or replace function public.admin_set_community_premium_entitlement(
  p_community_id uuid,
  p_tier text,
  p_access_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.admin_team
    where user_id = auth.uid() and role = 'ceo_owner' and status = 'active'
  ) then
    raise exception 'Only the CEO can grant Community Premium access';
  end if;

  if p_tier is null or p_tier not in ('free', 'premium', 'premium_plus') then
    raise exception 'Invalid Community Premium tier';
  end if;
  if p_access_until is not null and p_access_until <= now() then
    raise exception 'Access expiration must be in the future';
  end if;
  if not exists (select 1 from public.communities where id = p_community_id and deleted_at is null) then
    raise exception 'Community not found';
  end if;

  insert into public.community_premium_entitlements (
    community_id, tier, trial_started_at, trial_expires_at, access_until, updated_at, updated_by
  ) values (
    p_community_id, p_tier,
    case when p_tier = 'free' then null else now() end,
    case when p_tier = 'free' then now() else null end,
    p_access_until, now(), auth.uid()
  )
  on conflict (community_id) do update
  set tier = excluded.tier,
      trial_started_at = case when excluded.tier = 'free' then community_premium_entitlements.trial_started_at else coalesce(community_premium_entitlements.trial_started_at, excluded.trial_started_at) end,
      trial_expires_at = case when excluded.tier = 'free' then now() else community_premium_entitlements.trial_expires_at end,
      access_until = excluded.access_until,
      updated_at = now(),
      updated_by = auth.uid();
end;
$$;

alter function public.admin_set_community_premium_entitlement(uuid, text, timestamptz) owner to postgres;
revoke all on function public.admin_set_community_premium_entitlement(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_set_community_premium_entitlement(uuid, text, timestamptz) to authenticated;

create or replace function public.get_social_updates_entitled_communities(p_community_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct requested.community_id
  from unnest(coalesce(p_community_ids, array[]::uuid[])) as requested(community_id)
  where coalesce((public.get_community_premium_access(requested.community_id) #>> '{limits,social_updates}')::boolean, false);
$$;

alter function public.get_social_updates_entitled_communities(uuid[]) owner to postgres;
revoke all on function public.get_social_updates_entitled_communities(uuid[]) from public, anon;
grant execute on function public.get_social_updates_entitled_communities(uuid[]) to authenticated, service_role;

create or replace function public.enforce_community_member_premium_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  policy jsonb;
  member_limit integer;
  current_members integer;
begin
  perform 1 from public.communities where id = new.community_id and deleted_at is null for update;
  if not found then raise exception 'Community not found'; end if;

  policy := public.get_community_premium_access(new.community_id);
  member_limit := (policy #>> '{limits,members}')::integer;
  select count(*) into current_members
  from public.community_members
  where community_id = new.community_id;

  if current_members >= member_limit then
    raise exception 'This community has reached its % plan member limit of %', policy ->> 'tier', member_limit;
  end if;
  return new;
end;
$$;

alter function public.enforce_community_member_premium_limit() owner to postgres;
revoke all on function public.enforce_community_member_premium_limit() from public, anon, authenticated;

drop trigger if exists community_member_premium_limit on public.community_members;
create trigger community_member_premium_limit
before insert on public.community_members
for each row execute function public.enforce_community_member_premium_limit();

create or replace function public.enforce_community_channel_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  policy jsonb;
  channel_limit integer;
  current_channels integer;
begin
  if coalesce(new.is_default, false) or coalesce(new.integrations ->> 'ticket', 'false') = 'true' then
    return new;
  end if;

  perform 1 from public.communities where id = new.community_id and deleted_at is null for update;
  if not found then raise exception 'Community not found'; end if;

  policy := public.get_community_premium_access(new.community_id);
  channel_limit := (policy #>> '{limits,custom_channels}')::integer;
  select count(*) into current_channels
  from public.community_channels
  where community_id = new.community_id
    and not is_default
    and coalesce(integrations ->> 'ticket', 'false') <> 'true'
    and deleted_at is null;

  if current_channels >= channel_limit then
    raise exception 'This community has reached its % plan limit of % custom channels', policy ->> 'tier', channel_limit;
  end if;
  return new;
end;
$$;

alter function public.enforce_community_channel_limit() owner to postgres;
revoke all on function public.enforce_community_channel_limit() from public, anon, authenticated;

drop trigger if exists community_channel_limit on public.community_channels;
create trigger community_channel_limit
before insert on public.community_channels
for each row execute function public.enforce_community_channel_limit();

create or replace function public.enforce_community_social_connection_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  policy jsonb;
  connection_limit integer;
  current_connections integer;
begin
  if not new.enabled then return new; end if;

  perform 1 from public.communities where id = new.community_id and deleted_at is null for update;
  if not found then raise exception 'Community not found'; end if;

  policy := public.get_community_premium_access(new.community_id);
  if not coalesce((policy #>> '{limits,social_updates}')::boolean, false) then
    raise exception 'Social updates require an eligible Community Premium plan';
  end if;

  connection_limit := (policy #>> '{limits,social_connections}')::integer;
  select count(distinct connection_id) into current_connections
  from public.community_channel_sources
  where community_id = new.community_id
    and enabled
    and connection_id <> new.connection_id
    and id <> new.id;

  if current_connections >= connection_limit
    and not exists (
      select 1 from public.community_channel_sources
      where community_id = new.community_id
        and connection_id = new.connection_id
        and enabled
        and id <> new.id
    ) then
    raise exception 'This community has reached its % plan social connection limit of %', policy ->> 'tier', connection_limit;
  end if;
  return new;
end;
$$;

alter function public.enforce_community_social_connection_limit() owner to postgres;
revoke all on function public.enforce_community_social_connection_limit() from public, anon, authenticated;

drop trigger if exists community_social_connection_premium_limit on public.community_channel_sources;
create trigger community_social_connection_premium_limit
before insert or update of enabled, connection_id, community_id on public.community_channel_sources
for each row execute function public.enforce_community_social_connection_limit();

create or replace function public.create_community_ticket(
  p_community_id uuid,
  p_user_id uuid
)
returns public.community_channels
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.communities;
  ticket public.community_channels;
  open_count integer;
  ticket_limit integer;
  policy jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  select * into target from public.communities where id = p_community_id and deleted_at is null for update;
  if not found then raise exception 'Community not found'; end if;
  if not exists (select 1 from public.community_members where community_id = p_community_id and user_id = p_user_id) then raise exception 'You are not a member'; end if;

  policy := public.get_community_premium_access(p_community_id);
  ticket_limit := (policy #>> '{limits,open_tickets}')::integer;
  select count(*) into open_count from public.community_ticket_channels where community_id = p_community_id and status = 'open';
  if open_count >= ticket_limit then
    raise exception 'This community has reached its % plan open ticket limit of %', policy ->> 'tier', ticket_limit;
  end if;

  insert into public.community_channels (community_id, name, icon, description, type, is_private, category, tool_type, is_default, integrations, style)
  values (p_community_id, 'ticket-' || lpad((open_count + 1)::text, 4, '0'), '🎫', 'Private support ticket', 'text', true, 'Support', null, false, jsonb_build_object('ticket', true), '{}'::jsonb)
  returning * into ticket;
  insert into public.community_ticket_channels (community_id, channel_id, requester_id) values (p_community_id, ticket.id, p_user_id);
  insert into public.community_member_channel_access (community_id, channel_id, user_id, can_view, can_send, updated_by)
  values (p_community_id, ticket.id, p_user_id, true, true, p_user_id)
  on conflict (channel_id, user_id) do update set can_view = true, can_send = true;
  insert into public.community_member_channel_access (community_id, channel_id, user_id, can_view, can_send, updated_by)
  select p_community_id, ticket.id, m.user_id, true, true, p_user_id
  from public.community_members m
  join public.community_roles r on r.id = m.role_id
  where m.community_id = p_community_id
    and (r.permissions @> '{"administrator": true}'::jsonb
      or r.permissions @> '{"manageCommunity": true}'::jsonb
      or r.permissions @> '{"manageChannels": true}'::jsonb
      or r.permissions @> '{"manageMessages": true}'::jsonb)
  on conflict (channel_id, user_id) do update set can_view = true, can_send = true;
  return ticket;
end;
$$;

alter function public.create_community_ticket(uuid, uuid) owner to postgres;
revoke all on function public.create_community_ticket(uuid, uuid) from public;
grant execute on function public.create_community_ticket(uuid, uuid) to authenticated;
