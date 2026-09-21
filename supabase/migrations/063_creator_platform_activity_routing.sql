-- Creator platform activity routing and normalized inbound activity.
-- Channels remain creator-defined; this migration only connects platform sources
-- to those existing channels and gives the sync worker a durable contract.

alter table public.community_social_connections
  drop constraint if exists community_social_connections_provider_check;

alter table public.community_social_connections
  add constraint community_social_connections_provider_check
  check (provider in ('xeevia', 'x', 'facebook', 'instagram', 'tiktok', 'discord', 'youtube', 'twitch', 'snapchat', 'linkedin', 'kick', 'reddit', 'telegram', 'github'));

alter table public.community_social_connections
  add column if not exists source_url text,
  add column if not exists capabilities jsonb not null default '{}'::jsonb;

create table if not exists public.community_channel_sources (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  connection_id uuid not null references public.community_social_connections(id) on delete cascade,
  enabled boolean not null default true,
  content_types text[] not null default array['post', 'video', 'live'],
  include_in_live_feed boolean not null default false,
  sync_mode text not null default 'polling' check (sync_mode in ('webhook', 'polling', 'manual')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, connection_id)
);

create table if not exists public.community_external_activities (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  connection_id uuid not null references public.community_social_connections(id) on delete cascade,
  provider text not null,
  external_id text not null,
  activity_type text not null check (activity_type in ('post', 'video', 'clip', 'live', 'story', 'event')),
  status text not null default 'published' check (status in ('scheduled', 'live', 'published', 'ended', 'removed')),
  author_name text,
  author_avatar text,
  title text,
  content text,
  media jsonb not null default '{}'::jsonb,
  permalink text,
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_id, activity_type)
);

create table if not exists public.community_sync_runs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) on delete cascade,
  connection_id uuid references public.community_social_connections(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed')),
  items_seen integer not null default 0,
  items_written integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.community_channel_sources enable row level security;
alter table public.community_external_activities enable row level security;
alter table public.community_sync_runs enable row level security;

create policy community_channel_sources_members on public.community_channel_sources
  for select using (exists (select 1 from public.community_members m where m.community_id = community_channel_sources.community_id and m.user_id = auth.uid()));
create policy community_channel_sources_managers on public.community_channel_sources
  for all using (exists (select 1 from public.communities c where c.id = community_channel_sources.community_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.communities c where c.id = community_channel_sources.community_id and c.owner_id = auth.uid()));

create policy community_external_activities_members on public.community_external_activities
  for select using (exists (select 1 from public.community_members m where m.community_id = community_external_activities.community_id and m.user_id = auth.uid()));
create policy community_sync_runs_members on public.community_sync_runs
  for select using (exists (select 1 from public.community_members m where m.community_id = community_sync_runs.community_id and m.user_id = auth.uid()));

create index if not exists community_channel_sources_connection_idx
  on public.community_channel_sources(connection_id, enabled);
create index if not exists community_external_activities_channel_date_idx
  on public.community_external_activities(channel_id, published_at desc);
create index if not exists community_external_activities_live_idx
  on public.community_external_activities(status, activity_type, starts_at);
create index if not exists community_sync_runs_connection_date_idx
  on public.community_sync_runs(connection_id, started_at desc);
