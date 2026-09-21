-- Community bot integrations and destinations.
-- Bot credentials stay in Supabase Edge Function secrets; these tables store routing only.
create table if not exists public.community_bot_integrations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  provider text not null check (provider in ('discord', 'telegram')),
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'error')),
  connected_by uuid not null references public.profiles(id),
  config jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, provider)
);

create table if not exists public.community_bot_destinations (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.community_bot_integrations(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  provider text not null check (provider in ('discord', 'telegram')),
  external_id text not null,
  parent_external_id text,
  display_name text not null,
  destination_type text not null default 'channel' check (destination_type in ('guild', 'channel', 'chat')),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_id, external_id)
);

create table if not exists public.community_bot_deliveries (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  destination_id uuid not null references public.community_bot_destinations(id) on delete cascade,
  source_type text not null default 'xeevia',
  source_id uuid,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  external_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

alter table public.community_bot_integrations enable row level security;
alter table public.community_bot_destinations enable row level security;
alter table public.community_bot_deliveries enable row level security;

create policy community_bot_integrations_members on public.community_bot_integrations
  for select using (exists (select 1 from public.community_members m where m.community_id = community_bot_integrations.community_id and m.user_id = auth.uid()));
create policy community_bot_integrations_managers on public.community_bot_integrations
  for all using (exists (select 1 from public.communities c where c.id = community_bot_integrations.community_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.communities c where c.id = community_bot_integrations.community_id and c.owner_id = auth.uid()));

create policy community_bot_destinations_members on public.community_bot_destinations
  for select using (exists (select 1 from public.community_members m where m.community_id = community_bot_destinations.community_id and m.user_id = auth.uid()));
create policy community_bot_destinations_managers on public.community_bot_destinations
  for all using (exists (select 1 from public.communities c where c.id = community_bot_destinations.community_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.communities c where c.id = community_bot_destinations.community_id and c.owner_id = auth.uid()));

create policy community_bot_deliveries_members on public.community_bot_deliveries
  for select using (exists (select 1 from public.community_members m where m.community_id = community_bot_deliveries.community_id and m.user_id = auth.uid()));

create index if not exists community_bot_destinations_community_idx on public.community_bot_destinations(community_id, provider, enabled);
create index if not exists community_bot_deliveries_destination_idx on public.community_bot_deliveries(destination_id, created_at desc);
