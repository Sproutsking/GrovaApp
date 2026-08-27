-- Community channel foundation: ordered defaults, visual settings, and custom cap.
alter table public.community_channels
  add column if not exists is_default boolean not null default false,
  add column if not exists style jsonb not null default '{}'::jsonb,
  add column if not exists integrations jsonb not null default '{}'::jsonb;

create or replace function public.enforce_community_channel_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(new.is_default, false) and (
    select count(*) from public.community_channels
    where community_id = new.community_id
      and not is_default
      and deleted_at is null
  ) >= 9 then
    raise exception 'A community can have at most 9 custom channels';
  end if;
  return new;
end;
$$;

drop trigger if exists community_channel_limit on public.community_channels;
create trigger community_channel_limit
before insert on public.community_channels
for each row execute function public.enforce_community_channel_limit();

-- Keep existing channels usable and classify the original defaults by position.
update public.community_channels
set is_default = true
where position between 0 and 5;

-- Add the social updates channel to existing communities that do not have one.
insert into public.community_channels (community_id, name, icon, description, type, position, is_default, integrations)
select c.id, 'updates', '✦', 'Xeevia and connected social updates', 'text', 6, true,
       '{"xeevia": true, "x": false, "facebook": false, "instagram": false, "tiktok": false, "discord": false}'::jsonb
from public.communities c
where not exists (
  select 1 from public.community_channels ch
  where ch.community_id = c.id and lower(ch.name) = 'updates' and ch.deleted_at is null
);

-- Bring older communities up to the same default channel set.
insert into public.community_channels (community_id, name, icon, description, type, position, is_default)
select c.id, defaults.name, defaults.icon, defaults.description, defaults.type, defaults.position, true
from public.communities c
cross join (values
  ('verification', '✅', 'Verify yourself to access the community', 'text', 0),
  ('announcements', '📢', 'Official community announcements', 'announcement', 1),
  ('welcome', '👋', 'Welcome new members', 'text', 2),
  ('voice', '🔊', 'Voice conversations', 'voice', 3),
  ('support', '🛟', 'Get help from the community team', 'text', 4),
  ('general', '💬', 'General discussion', 'text', 5)
) as defaults(name, icon, description, type, position)
where not exists (
  select 1 from public.community_channels ch
  where ch.community_id = c.id and lower(ch.name) = defaults.name and ch.deleted_at is null
);
