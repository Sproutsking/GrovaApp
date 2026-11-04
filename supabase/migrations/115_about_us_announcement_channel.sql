update public.community_channels
set type = 'announcement',
    updated_at = now()
where lower(name) in ('about-us', 'official-links')
  and deleted_at is null
  and type is distinct from 'announcement';

create or replace function public.seed_community_experience_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
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
    ('about-us', 'ℹ️', 'About this community', 'announcement', 'Welcome', null, 2),
    ('official-links', '🔗', 'Official links', 'announcement', 'Information', null, 2),
    ('gm', '🌅', 'Good morning chat', 'text', 'Text', null, 2),
    ('ticket', '🎫', 'Private support tickets', 'text', 'Support', 'tickets', 1)
  ) as defaults(name, icon, description, type, category, tool_type, position)
  where not exists (
    select 1 from public.community_channels existing
    where existing.community_id = new.id
      and lower(existing.name) = lower(defaults.name)
      and existing.deleted_at is null
  );

  update public.community_channels
  set category = 'Welcome'
  where community_id = new.id and lower(name) = 'verification';
  update public.community_channels
  set category = 'Information'
  where community_id = new.id and lower(name) in ('announcements', 'updates');
  update public.community_channels
  set category = 'Text'
  where community_id = new.id and lower(name) in ('general', 'voice');
  update public.community_channels
  set category = 'Support', tool_type = 'tickets'
  where community_id = new.id and lower(name) = 'ticket';
  update public.community_channels
  set type = 'announcement'
  where community_id = new.id and lower(name) in ('about-us', 'official-links');

  insert into public.community_tool_settings (community_id, tool_type, enabled, channel_id)
  select new.id, 'tickets', true, ch.id
  from public.community_channels ch
  where ch.community_id = new.id and lower(ch.name) = 'ticket'
  on conflict (community_id, tool_type) do update
  set channel_id = coalesce(public.community_tool_settings.channel_id, excluded.channel_id);

  return new;
end;
$$;
