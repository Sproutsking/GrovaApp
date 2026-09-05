-- Additive channel access foundations. Existing channels and arrangements are preserved.
alter table public.community_channels
  add column if not exists is_locked boolean not null default false,
  add column if not exists notifications_muted boolean not null default false;

alter table public.community_tool_settings
  drop constraint if exists community_tool_settings_tool_type_check;

alter table public.community_tool_settings
  add constraint community_tool_settings_tool_type_check
  check (tool_type in ('verification', 'social_updates', 'tickets', 'welcome'));

create table if not exists public.channel_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  role_id uuid not null references public.community_roles(id) on delete cascade,
  permission text not null check (permission in ('viewChannel', 'sendMessages', 'addReactions', 'attachFiles', 'mentionEveryone', 'manageMessages')),
  state text not null check (state in ('allow', 'deny')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, role_id, permission)
);

create table if not exists public.category_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  category_id uuid not null references public.community_channel_categories(id) on delete cascade,
  role_id uuid not null references public.community_roles(id) on delete cascade,
  permission text not null check (permission in ('viewChannel', 'sendMessages', 'addReactions', 'attachFiles', 'mentionEveryone', 'manageMessages')),
  state text not null check (state in ('allow', 'deny')),
  apply_to_channels boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, role_id, permission)
);

alter table public.channel_permission_overrides enable row level security;
alter table public.category_permission_overrides enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'channel_permission_overrides' and policyname = 'channel_permission_overrides_members') then
    create policy channel_permission_overrides_members on public.channel_permission_overrides for select using (
      exists (select 1 from public.community_members m where m.community_id = channel_permission_overrides.community_id and m.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'channel_permission_overrides' and policyname = 'channel_permission_overrides_managers') then
    create policy channel_permission_overrides_managers on public.channel_permission_overrides for all using (
      exists (select 1 from public.communities c where c.id = channel_permission_overrides.community_id and c.owner_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'category_permission_overrides' and policyname = 'category_permission_overrides_members') then
    create policy category_permission_overrides_members on public.category_permission_overrides for select using (
      exists (select 1 from public.community_members m where m.community_id = category_permission_overrides.community_id and m.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'category_permission_overrides' and policyname = 'category_permission_overrides_managers') then
    create policy category_permission_overrides_managers on public.category_permission_overrides for all using (
      exists (select 1 from public.communities c where c.id = category_permission_overrides.community_id and c.owner_id = auth.uid())
    );
  end if;
end $$;

create index if not exists channel_permission_overrides_lookup_idx
  on public.channel_permission_overrides(community_id, channel_id, role_id);
create index if not exists category_permission_overrides_lookup_idx
  on public.category_permission_overrides(community_id, category_id, role_id);

-- Ticket staff visibility follows the community's manage-channels benchmark.
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
    and (r.permissions @> '{"administrator": true}'::jsonb
      or r.permissions @> '{"manageCommunity": true}'::jsonb
      or r.permissions @> '{"manageChannels": true}'::jsonb
      or r.permissions @> '{"manageMessages": true}'::jsonb)
  on conflict (channel_id, user_id) do update set can_view = true, can_send = true;
  return ticket;
end;
$$;

alter function public.create_community_ticket(uuid, uuid) owner to postgres;
revoke all on function public.create_community_ticket(uuid, uuid) from public;
grant execute on function public.create_community_ticket(uuid, uuid) to authenticated;