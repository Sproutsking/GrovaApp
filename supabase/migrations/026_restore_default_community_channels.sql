-- Restore the canonical default channel set for communities created before
-- the channel/tool migration. Each insert is guarded by community + name so
-- this migration is safe to run against partially repaired communities.

-- Some databases have the foundation migration (017) but not the later tools
-- migration (025). Add the columns this backfill needs before inserting rows.
alter table public.community_channels
  add column if not exists category text not null default 'Channels',
  add column if not exists tool_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_channels_tool_type_check'
      and conrelid = 'public.community_channels'::regclass
  ) then
    alter table public.community_channels
      add constraint community_channels_tool_type_check
      check (tool_type is null or tool_type in ('verification', 'social_updates', 'tickets'));
  end if;
end $$;

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

update public.community_channels
set tool_type = 'verification'
where deleted_at is null
  and lower(name) in ('verify', 'verification');

update public.community_channels
set tool_type = 'social_updates'
where deleted_at is null
  and lower(name) = 'updates';

insert into public.community_channels
  (community_id, name, icon, description, type, tool_type, position, is_default, category, integrations)
select c.id, d.name, d.icon, d.description, d.type, d.tool_type, d.position, true, 'Start here', d.integrations
from public.communities c
cross join (values
  ('verify',        '✅', 'Verify yourself to access the community', 'text',         'verification',   0, '{}'::jsonb),
  ('announcements', '📢', 'Official community announcements',          'announcement', null,             1, '{}'::jsonb),
  ('welcome',       '👋', 'Welcome new members',                       'text',         null,             2, '{}'::jsonb),
  ('voice',         '🔊', 'Voice conversations',                       'voice',        null,             3, '{}'::jsonb),
  ('support',       '🛟', 'Get help from the community team',           'text',         null,             4, '{}'::jsonb),
  ('general',       '💬', 'General discussion',                        'text',         null,             5, '{}'::jsonb),
  ('updates',       '✦',  'Xeevia and connected social updates',        'text',         'social_updates', 6, '{"xeevia":true}'::jsonb)
) as d(name, icon, description, type, tool_type, position, integrations)
where c.deleted_at is null
  and not exists (
    select 1
    from public.community_channels ch
    where ch.community_id = c.id
      and ch.deleted_at is null
      and lower(ch.name) in (d.name, case when d.name = 'verify' then 'verification' else d.name end)
  );

insert into public.community_tool_settings (community_id, tool_type, enabled, channel_id)
select distinct on (c.id) c.id, 'verification', true, ch.id
from public.communities c
join public.community_channels ch
  on ch.community_id = c.id
 and ch.deleted_at is null
 and lower(ch.name) in ('verify', 'verification')
where c.deleted_at is null
order by c.id, ch.name
on conflict (community_id, tool_type) do update
set enabled = true, channel_id = excluded.channel_id;

insert into public.community_tool_settings (community_id, tool_type, enabled)
select c.id, tool.tool_type, false
from public.communities c
cross join (values ('social_updates'), ('tickets')) as tool(tool_type)
where c.deleted_at is null
on conflict (community_id, tool_type) do nothing;