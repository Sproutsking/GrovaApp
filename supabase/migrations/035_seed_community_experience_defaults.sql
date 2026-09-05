-- Ensure every community has the requested five-category starting experience.
create or replace function public.seed_community_experience_defaults()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.community_channel_categories (community_id, name, position)
  values
    (new.id, 'Welcome', 0),
    (new.id, 'Information', 1),
    (new.id, 'Text', 2),
    (new.id, 'Contest', 3),
    (new.id, 'Support', 4)
  on conflict (community_id, name) do nothing;

  insert into public.community_channels (community_id, name, icon, description, type, category, tool_type, position, is_default)
  select new.id, defaults.name, defaults.icon, defaults.description, defaults.type, defaults.category, defaults.tool_type, defaults.position, true
  from (values
    ('rules', '📜', 'Community rules', 'text', 'Welcome', null, 1),
    ('about-us', 'ℹ️', 'About this community', 'text', 'Welcome', null, 2),
    ('official-links', '🔗', 'Official links', 'text', 'Information', null, 2),
    ('gm', '🌅', 'Good morning chat', 'text', 'Text', null, 2),
    ('ticket', '🎫', 'Private support tickets', 'text', 'Support', 'tickets', 1)
  ) as defaults(name, icon, description, type, category, tool_type, position)
  where not exists (
    select 1 from public.community_channels existing
    where existing.community_id = new.id and lower(existing.name) = lower(defaults.name) and existing.deleted_at is null
  );

  update public.community_channels set category = 'Welcome' where community_id = new.id and lower(name) = 'verification';
  update public.community_channels set category = 'Information' where community_id = new.id and lower(name) in ('announcements', 'updates');
  update public.community_channels set category = 'Text' where community_id = new.id and lower(name) in ('general', 'voice');
  update public.community_channels set category = 'Support', tool_type = 'tickets' where community_id = new.id and lower(name) = 'ticket';

  insert into public.community_tool_settings (community_id, tool_type, enabled, channel_id)
  select new.id, 'tickets', true, ch.id
  from public.community_channels ch
  where ch.community_id = new.id and lower(ch.name) = 'ticket'
  on conflict (community_id, tool_type) do update set channel_id = coalesce(public.community_tool_settings.channel_id, excluded.channel_id);
  return new;
end;
$$;

drop trigger if exists seed_community_experience_defaults_trigger on public.communities;
create trigger seed_community_experience_defaults_trigger
after insert on public.communities
for each row execute function public.seed_community_experience_defaults();

-- Run the same seed for communities that already exist.
insert into public.community_channel_categories (community_id, name, position)
select c.id, defaults.name, defaults.position
from public.communities c
cross join (values ('Welcome', 0), ('Information', 1), ('Text', 2), ('Contest', 3), ('Support', 4)) defaults(name, position)
on conflict (community_id, name) do nothing;

update public.community_channels set name = 'verification'
where lower(name) = 'verify' and is_default = true and deleted_at is null;

insert into public.community_channels (community_id, name, icon, description, type, category, tool_type, position, is_default)
select c.id, defaults.name, defaults.icon, defaults.description, defaults.type, defaults.category, defaults.tool_type, defaults.position, true
from public.communities c
cross join (values
  ('rules', '📜', 'Community rules', 'text', 'Welcome', null, 1),
  ('about-us', 'ℹ️', 'About this community', 'text', 'Welcome', null, 2),
  ('official-links', '🔗', 'Official links', 'text', 'Information', null, 2),
  ('gm', '🌅', 'Good morning chat', 'text', 'Text', null, 2),
  ('ticket', '🎫', 'Private support tickets', 'text', 'Support', 'tickets', 1)
) defaults(name, icon, description, type, category, tool_type, position)
where c.deleted_at is null and not exists (
  select 1 from public.community_channels ch where ch.community_id = c.id and lower(ch.name) = lower(defaults.name) and ch.deleted_at is null
);

update public.community_channels set category = 'Welcome' where lower(name) = 'verification' and deleted_at is null;
update public.community_channels set category = 'Information' where lower(name) in ('announcements', 'updates') and deleted_at is null;
update public.community_channels set category = 'Text' where lower(name) in ('general', 'voice') and deleted_at is null;
update public.community_channels set category = 'Support', tool_type = 'tickets' where lower(name) = 'ticket' and deleted_at is null;
