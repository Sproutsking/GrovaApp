create table if not exists public.group_chat_reads (
  group_id text not null references public.group_chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_chat_reads enable row level security;

drop policy if exists group_chat_reads_owner_select on public.group_chat_reads;
create policy group_chat_reads_owner_select on public.group_chat_reads
  for select to authenticated
  using (user_id = auth.uid());

insert into public.group_chat_reads (group_id, user_id, last_read_at)
select groups.id, member_id::uuid, groups.created_at
from public.group_chats groups
cross join lateral unnest(groups.member_ids) as members(member_id)
where member_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict (group_id, user_id) do nothing;

create or replace function public.initialize_group_chat_read_cursors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_chat_reads (group_id, user_id, last_read_at)
  select new.id, member_id::uuid, now()
  from unnest(new.member_ids) as members(member_id)
  where member_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists initialize_group_chat_read_cursors on public.group_chats;
create trigger initialize_group_chat_read_cursors
after insert or update of member_ids on public.group_chats
for each row execute function public.initialize_group_chat_read_cursors();

create or replace function public.mark_group_chat_read(p_group_id text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  read_cursor timestamptz := now();
begin
  if auth.uid() is null or not exists (
    select 1 from public.group_chats groups
    where groups.id = p_group_id and auth.uid()::text = any(groups.member_ids)
  ) then
    raise exception 'Group not found or access denied';
  end if;

  insert into public.group_chat_reads (group_id, user_id, last_read_at)
  values (p_group_id, auth.uid(), read_cursor)
  on conflict (group_id, user_id) do update
    set last_read_at = excluded.last_read_at
  returning last_read_at into read_cursor;

  return read_cursor;
end;
$$;

create or replace function public.get_group_chat_unread_counts()
returns table(group_id text, unread_count bigint, last_read_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select groups.id,
         count(messages.id) as unread_count,
         reads.last_read_at
  from public.group_chats groups
  left join public.group_chat_reads reads
    on reads.group_id = groups.id and reads.user_id = auth.uid()
  left join public.group_messages messages
    on messages.group_id = groups.id
   and messages.user_id <> auth.uid()
   and messages.deleted_at is null
   and messages.created_at > coalesce(reads.last_read_at, groups.created_at)
  where auth.uid() is not null
    and auth.uid()::text = any(groups.member_ids)
  group by groups.id, reads.last_read_at;
$$;

alter function public.initialize_group_chat_read_cursors() owner to postgres;
alter function public.mark_group_chat_read(text) owner to postgres;
alter function public.get_group_chat_unread_counts() owner to postgres;

revoke all on function public.initialize_group_chat_read_cursors() from public;
revoke all on function public.mark_group_chat_read(text) from public;
revoke all on function public.get_group_chat_unread_counts() from public;
grant execute on function public.mark_group_chat_read(text) to authenticated;
grant execute on function public.get_group_chat_unread_counts() to authenticated;
