-- Social Updates channel foundation.
create table if not exists public.community_social_connections (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  connected_by uuid not null references public.profiles(id),
  provider text not null check (provider in ('xeevia', 'x', 'facebook', 'instagram', 'tiktok', 'discord')),
  provider_account_id text,
  display_name text,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'revoked', 'error')),
  scopes text[] not null default '{}',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, provider, provider_account_id)
);

create table if not exists public.community_external_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  connection_id uuid not null references public.community_social_connections(id) on delete cascade,
  provider text not null,
  external_post_id text not null,
  author_name text,
  author_avatar text,
  content text,
  media jsonb not null default '{}'::jsonb,
  permalink text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (connection_id, external_post_id)
);

alter table public.community_social_connections enable row level security;
alter table public.community_external_posts enable row level security;

create policy community_social_connections_members on public.community_social_connections
  for select using (exists (select 1 from public.community_members m where m.community_id = community_social_connections.community_id and m.user_id = auth.uid()));
create policy community_social_connections_managers on public.community_social_connections
  for all using (exists (select 1 from public.communities c where c.id = community_social_connections.community_id and c.owner_id = auth.uid()));
create policy community_external_posts_members on public.community_external_posts
  for select using (exists (select 1 from public.community_members m where m.community_id = community_external_posts.community_id and m.user_id = auth.uid()));

create index if not exists community_external_posts_channel_date_idx on public.community_external_posts(channel_id, published_at desc);
