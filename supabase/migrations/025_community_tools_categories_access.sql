-- Community tools are configured at community level and delivered to a chosen
-- channel. Channels remain ordinary channels; their tool message is optional.

alter table public.community_channels
  add column if not exists category text not null default 'Channels',
  add column if not exists tool_type text check (tool_type in ('verification', 'social_updates', 'tickets'));

update public.community_channels
set name = 'verify', tool_type = 'verification'
where lower(name) = 'verification' and deleted_at is null
  and not exists (
    select 1 from public.community_channels existing
    where existing.community_id = public.community_channels.community_id
      and lower(existing.name) = 'verify'
      and existing.deleted_at is null
  );

update public.community_channels
set tool_type = 'social_updates'
where lower(name) = 'updates' and deleted_at is null;

create table if not exists public.community_tool_settings (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  tool_type text not null check (tool_type in ('verification', 'social_updates', 'tickets')),
  enabled boolean not null default false,
  channel_id uuid references public.community_channels(id) on delete set null,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, tool_type)
);

create table if not exists public.community_channel_categories (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  position integer not null default 0,
  collapsed_by_default boolean not null default false,
  style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, name)
);

create table if not exists public.community_member_channel_access (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_view boolean not null default true,
  can_send boolean not null default false,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

alter table public.community_tool_settings enable row level security;
alter table public.community_channel_categories enable row level security;
alter table public.community_member_channel_access enable row level security;

create policy community_tool_settings_members on public.community_tool_settings
  for select using (exists (select 1 from public.community_members m where m.community_id = community_tool_settings.community_id and m.user_id = auth.uid()));
create policy community_tool_settings_managers on public.community_tool_settings
  for all using (exists (select 1 from public.communities c where c.id = community_tool_settings.community_id and c.owner_id = auth.uid()));
create policy community_channel_categories_members on public.community_channel_categories
  for select using (exists (select 1 from public.community_members m where m.community_id = community_channel_categories.community_id and m.user_id = auth.uid()));
create policy community_channel_categories_managers on public.community_channel_categories
  for all using (exists (select 1 from public.communities c where c.id = community_channel_categories.community_id and c.owner_id = auth.uid()));
create policy community_member_channel_access_members on public.community_member_channel_access
  for select using (user_id = auth.uid() or exists (select 1 from public.communities c where c.id = community_member_channel_access.community_id and c.owner_id = auth.uid()));
create policy community_member_channel_access_managers on public.community_member_channel_access
  for all using (exists (select 1 from public.communities c where c.id = community_member_channel_access.community_id and c.owner_id = auth.uid()));

insert into public.community_tool_settings (community_id, tool_type, enabled, channel_id)
select c.id, tool.tool_type, tool.enabled, (
  select ch.id from public.community_channels ch
  where ch.community_id = c.id and ch.tool_type = tool.tool_type and ch.deleted_at is null
  order by ch.position limit 1
)
from public.communities c
cross join (values ('verification', true), ('social_updates', false), ('tickets', false)) as tool(tool_type, enabled)
on conflict (community_id, tool_type) do nothing;

insert into public.community_channel_categories (community_id, name, position)
select distinct community_id, category, 0
from public.community_channels
where category is not null
on conflict (community_id, name) do nothing;

create index if not exists community_channels_category_idx
  on public.community_channels(community_id, category, position);
create index if not exists community_member_channel_access_lookup_idx
  on public.community_member_channel_access(community_id, user_id, channel_id);