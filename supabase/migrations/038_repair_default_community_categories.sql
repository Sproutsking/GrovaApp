-- Repair category rows for existing communities without changing channels or
-- the position of categories owners have already configured.
insert into public.community_channel_categories (community_id, name, position)
select c.id, defaults.name, defaults.position
from public.communities c
cross join (values
  ('Welcome', 0),
  ('Information', 1),
  ('Text', 2),
  ('Contest', 3),
  ('Support', 4)
) as defaults(name, position)
where c.deleted_at is null
on conflict (community_id, name) do nothing;