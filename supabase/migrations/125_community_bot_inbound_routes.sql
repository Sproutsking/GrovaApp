alter table public.community_bot_destinations
  add column if not exists inbound_enabled boolean not null default false,
  add column if not exists xeevia_channel_id uuid references public.community_channels(id) on delete set null;

create or replace function public.validate_community_bot_inbound_route()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.inbound_enabled and new.xeevia_channel_id is null then
    raise exception 'Choose an Xeevia channel before enabling inbound sync';
  end if;
  if new.xeevia_channel_id is not null and not exists (
    select 1 from public.community_channels channel
    where channel.id = new.xeevia_channel_id
      and channel.community_id = new.community_id
      and channel.deleted_at is null
      and channel.type <> 'voice'
  ) then
    raise exception 'The inbound Xeevia destination must be an active text channel in this community';
  end if;
  return new;
end;
$$;

drop trigger if exists community_bot_inbound_route_validate on public.community_bot_destinations;
create trigger community_bot_inbound_route_validate
  before insert or update of community_id, xeevia_channel_id, inbound_enabled
  on public.community_bot_destinations
  for each row execute function public.validate_community_bot_inbound_route();

create table if not exists public.community_bot_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  xeevia_channel_id uuid not null references public.community_channels(id) on delete cascade,
  destination_id uuid not null references public.community_bot_destinations(id) on delete cascade,
  provider text not null check (provider in ('discord', 'telegram')),
  external_message_id text not null,
  external_author_id text,
  external_author_name text not null,
  external_author_avatar text,
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  external_url text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (destination_id, external_message_id)
);

create index if not exists community_bot_inbound_messages_channel_date_idx
  on public.community_bot_inbound_messages(xeevia_channel_id, sent_at desc);

alter table public.community_bot_inbound_messages enable row level security;
revoke all on public.community_bot_inbound_messages from anon, authenticated;
grant select on public.community_bot_inbound_messages to authenticated;

drop policy if exists community_bot_inbound_messages_visible on public.community_bot_inbound_messages;
create policy community_bot_inbound_messages_visible
  on public.community_bot_inbound_messages for select to authenticated
  using (public.community_user_can_access_channel(community_id, auth.uid(), xeevia_channel_id, 'view'));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'community_bot_inbound_messages'
    ) then
    alter publication supabase_realtime add table public.community_bot_inbound_messages;
  end if;
end;
$$;