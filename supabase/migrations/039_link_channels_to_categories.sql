-- Give every channel a durable category relationship while retaining the
-- category name for compatibility with older clients and integrations.
alter table public.community_channels
  add column if not exists category_id uuid references public.community_channel_categories(id) on delete set null;

update public.community_channels ch
set category_id = categories.id
from public.community_channel_categories categories
where categories.community_id = ch.community_id
  and lower(categories.name) = lower(ch.category)
  and ch.category_id is null;

create index if not exists community_channels_category_id_idx
  on public.community_channels(community_id, category_id, position);

create or replace function public.sync_channel_category_link()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.category_id is null and new.category is not null then
    select id into new.category_id
    from public.community_channel_categories
    where community_id = new.community_id and lower(name) = lower(new.category)
    limit 1;
  end if;
  if new.category_id is not null then
    select name into new.category
    from public.community_channel_categories
    where id = new.category_id and community_id = new.community_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_channel_category_link_trigger on public.community_channels;
create trigger sync_channel_category_link_trigger
before insert or update of category, category_id on public.community_channels
for each row execute function public.sync_channel_category_link();