-- Default category structure, configurable verification cards, and private ticket channels.

alter table public.community_channels
  add column if not exists category text not null default 'Channels',
  add column if not exists tool_type text check (tool_type in ('verification', 'social_updates', 'tickets'));

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

create table if not exists public.community_channel_categories (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  position integer not null default 0,
  collapsed_by_default boolean not null default false,
  style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, name)
);

create table if not exists public.community_member_channel_access (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_view boolean not null default true,
  can_send boolean not null default false,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

alter table public.community_tool_settings enable row level security;
alter table public.community_channel_categories enable row level security;
alter table public.community_member_channel_access enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_tool_settings' and policyname = 'community_tool_settings_members') then
    create policy community_tool_settings_members on public.community_tool_settings for select using (exists (select 1 from public.community_members m where m.community_id = community_tool_settings.community_id and m.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_tool_settings' and policyname = 'community_tool_settings_managers') then
    create policy community_tool_settings_managers on public.community_tool_settings for all using (exists (select 1 from public.communities c where c.id = community_tool_settings.community_id and c.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_channel_categories' and policyname = 'community_channel_categories_members') then
    create policy community_channel_categories_members on public.community_channel_categories for select using (exists (select 1 from public.community_members m where m.community_id = community_channel_categories.community_id and m.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_channel_categories' and policyname = 'community_channel_categories_managers') then
    create policy community_channel_categories_managers on public.community_channel_categories for all using (exists (select 1 from public.communities c where c.id = community_channel_categories.community_id and c.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_member_channel_access' and policyname = 'community_member_channel_access_members') then
    create policy community_member_channel_access_members on public.community_member_channel_access for select using (user_id = auth.uid() or exists (select 1 from public.communities c where c.id = community_member_channel_access.community_id and c.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_member_channel_access' and policyname = 'community_member_channel_access_managers') then
    create policy community_member_channel_access_managers on public.community_member_channel_access for all using (exists (select 1 from public.communities c where c.id = community_member_channel_access.community_id and c.owner_id = auth.uid()));
  end if;
end $$;

create table if not exists public.community_ticket_channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null unique references public.community_channels(id) on delete cascade,
  requester_id uuid not null references public.profiles(id),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id)
);

alter table public.community_ticket_channels enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_ticket_channels' and policyname = 'community_ticket_channels_members') then
    create policy community_ticket_channels_members on public.community_ticket_channels
      for select using (
        requester_id = auth.uid()
        or exists (
          select 1 from public.communities c
          where c.id = community_ticket_channels.community_id and c.owner_id = auth.uid()
        )
      );
  end if;
end $$;
create index if not exists community_ticket_channels_open_idx
  on public.community_ticket_channels(community_id, status);

insert into public.community_channel_categories (community_id, name, position)
select c.id, defaults.name, defaults.position
from public.communities c
cross join (values
  ('Welcome', 0), ('Information', 1), ('Text', 2), ('Contest', 3), ('Support', 4)
) as defaults(name, position)
on conflict (community_id, name) do update
set position = excluded.position;

update public.community_channels set category = 'Welcome'
where lower(name) in ('welcome', 'rules', 'about us', 'verification', 'verify') and deleted_at is null;
update public.community_channels set category = 'Information'
where lower(name) in ('announcements', 'official links', 'updates') and deleted_at is null;
update public.community_channels set category = 'Text'
where lower(name) in ('general', 'general chat', 'gm', 'gm chat') and deleted_at is null;
update public.community_channels set category = 'Support'
where lower(name) in ('support', 'ticket', 'tickets') and deleted_at is null;

create or replace function public.create_community_ticket(
  p_community_id uuid,
  p_user_id uuid
)
returns public.community_channels
language plpgsql security definer set search_path = public
as $$
declare
  target public.communities;
  ticket public.community_channels;
  open_count integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  select * into target from public.communities where id = p_community_id and deleted_at is null;
  if not found then raise exception 'Community not found'; end if;
  if not exists (select 1 from public.community_members where community_id = p_community_id and user_id = p_user_id) then raise exception 'You are not a member'; end if;

  select count(*) into open_count from public.community_ticket_channels where community_id = p_community_id and status = 'open';
  if open_count >= 25 then raise exception 'This community has reached its 25 open ticket limit'; end if;

  insert into public.community_channels (community_id, name, icon, description, type, is_private, category, tool_type, is_default, integrations, style)
  values (p_community_id, 'ticket-' || lpad((open_count + 1)::text, 4, '0'), '🎫', 'Private support ticket', 'text', true, 'Support', null, false, jsonb_build_object('ticket', true), '{}'::jsonb)
  returning * into ticket;

  insert into public.community_ticket_channels (community_id, channel_id, requester_id) values (p_community_id, ticket.id, p_user_id);
  insert into public.community_member_channel_access (community_id, channel_id, user_id, can_view, can_send, updated_by)
  values (p_community_id, ticket.id, p_user_id, true, true, p_user_id)
  on conflict (channel_id, user_id) do update set can_view = true, can_send = true;

  insert into public.community_member_channel_access (community_id, channel_id, user_id, can_view, can_send, updated_by)
  select p_community_id, ticket.id, m.user_id, true, true, p_user_id
  from public.community_members m
  join public.community_roles r on r.id = m.role_id
  where m.community_id = p_community_id
    and (r.permissions @> '{"administrator": true}'::jsonb or r.permissions @> '{"manageCommunity": true}'::jsonb or r.permissions @> '{"manageMessages": true}'::jsonb)
  on conflict (channel_id, user_id) do update set can_view = true, can_send = true;
  return ticket;
end;
$$;

create or replace function public.close_community_ticket(p_channel_id uuid, p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare ticket_row public.community_ticket_channels;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  select * into ticket_row from public.community_ticket_channels where channel_id = p_channel_id and status = 'open' for update;
  if not found then return false; end if;
  if ticket_row.requester_id <> p_user_id and not exists (select 1 from public.communities c where c.id = ticket_row.community_id and c.owner_id = p_user_id) then raise exception 'You cannot close this ticket'; end if;
  update public.community_ticket_channels set status = 'closed', closed_at = now(), closed_by = p_user_id where channel_id = p_channel_id;
  update public.community_channels set deleted_at = now(), updated_at = now() where id = p_channel_id;
  return true;
end;
$$;

alter function public.create_community_ticket(uuid, uuid) owner to postgres;
alter function public.close_community_ticket(uuid, uuid) owner to postgres;
revoke all on function public.create_community_ticket(uuid, uuid) from public;
revoke all on function public.close_community_ticket(uuid, uuid) from public;
grant execute on function public.create_community_ticket(uuid, uuid) to authenticated;
grant execute on function public.close_community_ticket(uuid, uuid) to authenticated;
