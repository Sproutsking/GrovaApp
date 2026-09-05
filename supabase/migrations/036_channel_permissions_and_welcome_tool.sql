-- Additive channel access foundations. Existing channels and arrangements are preserved.
alter table public.community_channels
  add column if not exists is_locked boolean not null default false,
  add column if not exists notifications_muted boolean not null default false;

alter table public.community_tool_settings
  drop constraint if exists community_tool_settings_tool_type_check;

alter table public.community_tool_settings
  add constraint community_tool_settings_tool_type_check
  check (tool_type in ('verification', 'social_updates', 'tickets', 'welcome'));

create table if not exists public.channel_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  role_id uuid not null references public.community_roles(id) on delete cascade,
  permission text not null check (permission in ('viewChannel', 'sendMessages', 'addReactions', 'attachFiles', 'mentionEveryone', 'manageMessages')),
  state text not null check (state in ('allow', 'deny')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, role_id, permission)
);

create table if not exists public.category_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  category_id uuid not null references public.community_channel_categories(id) on delete cascade,
  role_id uuid not null references public.community_roles(id) on delete cascade,
  permission text not null check (permission in ('viewChannel', 'sendMessages', 'addReactions', 'attachFiles', 'mentionEveryone', 'manageMessages')),
  state text not null check (state in ('allow', 'deny')),
  apply_to_channels boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, role_id, permission)
);

alter table public.channel_permission_overrides enable row level security;
alter table public.category_permission_overrides enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'channel_permission_overrides' and policyname = 'channel_permission_overrides_members') then
    create policy channel_permission_overrides_members on public.channel_permission_overrides for select using (
      exists (select 1 from public.community_members m where m.community_id = channel_permission_overrides.community_id and m.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'channel_permission_overrides' and policyname = 'channel_permission_overrides_managers') then
    create policy channel_permission_overrides_managers on public.channel_permission_overrides for all using (
      exists (select 1 from public.communities c where c.id = channel_permission_overrides.community_id and c.owner_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'category_permission_overrides' and policyname = 'category_permission_overrides_members') then
    create policy category_permission_overrides_members on public.category_permission_overrides for select using (
      exists (select 1 from public.community_members m where m.community_id = category_permission_overrides.community_id and m.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'category_permission_overrides' and policyname = 'category_permission_overrides_managers') then
    create policy category_permission_overrides_managers on public.category_permission_overrides for all using (
      exists (select 1 from public.communities c where c.id = category_permission_overrides.community_id and c.owner_id = auth.uid())
    );
  end if;
end $$;

create index if not exists channel_permission_overrides_lookup_idx
  on public.channel_permission_overrides(community_id, channel_id, role_id);
create index if not exists category_permission_overrides_lookup_idx
  on public.category_permission_overrides(community_id, category_id, role_id);