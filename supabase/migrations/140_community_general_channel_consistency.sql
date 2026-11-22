insert into public.community_channel_categories (community_id, name, position)
select community.id, 'Text', 2
from public.communities community
where community.deleted_at is null
on conflict (community_id, name) do nothing;

create or replace function public.normalize_community_general_channel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_default and lower(trim(old.name)) = 'general' then
      raise exception 'The built-in #general channel cannot be deleted';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
    and old.is_default
    and lower(trim(old.name)) = 'general'
    and (
      new.deleted_at is not null
      or lower(trim(new.name)) <> 'general'
      or not coalesce(new.is_default, false)
    ) then
    raise exception 'The built-in #general channel cannot be renamed or deleted';
  end if;

  if lower(trim(new.name)) = 'general' then
    if not coalesce(new.is_default, false) then
      raise exception '#general is reserved for the community default channel';
    end if;
    new.name := 'general';
    new.type := 'text';
    new.category := 'Text';
    select category.id into new.category_id
    from public.community_channel_categories category
    where category.community_id = new.community_id
      and lower(category.name) = 'text'
    limit 1;
    new.is_private := false;
    new.tool_type := null;
    new.position := 0;
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_community_general_channel() from public;
drop trigger if exists community_general_channel_consistency on public.community_channels;
create trigger community_general_channel_consistency
before insert or update or delete on public.community_channels
for each row execute function public.normalize_community_general_channel();

with ranked_general_channels as (
  select id,
    row_number() over (
      partition by community_id
      order by is_default desc, position asc, created_at asc, id
    ) as row_number
  from public.community_channels
  where deleted_at is null and lower(trim(name)) = 'general'
)
update public.community_channels channel
set name = 'general',
    type = 'text',
    category = 'Text',
    is_private = false,
    tool_type = null,
    category_id = (
      select category.id
      from public.community_channel_categories category
      where category.community_id = channel.community_id
        and lower(category.name) = 'text'
      limit 1
    ),
    position = 0,
    is_default = true,
    updated_at = now()
from ranked_general_channels ranked
where channel.id = ranked.id and ranked.row_number = 1;

insert into public.community_channels
  (community_id, name, icon, description, type, category, position, is_default)
select community.id, 'general', '💬', 'General discussion', 'text', 'Text', 0, true
from public.communities community
where community.deleted_at is null
  and not exists (
    select 1
    from public.community_channels channel
    where channel.community_id = community.id
      and channel.deleted_at is null
      and lower(trim(channel.name)) = 'general'
  );
