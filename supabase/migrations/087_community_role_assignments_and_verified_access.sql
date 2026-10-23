-- Multiple role assignments are ranked by role position (lower position wins).
-- community_members.role_id remains a compatibility mirror of the effective role.
-- Remove the legacy entry points so verification can only complete through the
-- role-selection-aware RPC below.
drop function if exists public.complete_community_verification(uuid, text, text, boolean);
drop function if exists public.verify_community_member(uuid, uuid, text);

create table if not exists public.community_member_roles (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.community_roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (community_id, user_id, role_id)
);

create index if not exists community_member_roles_effective_idx
  on public.community_member_roles(community_id, user_id, role_id);

insert into public.community_roles (community_id, name, color, position, permissions, is_default)
select c.id, 'Owner', '#FFD700', 0,
  jsonb_build_object(
    'sendMessages', true,
    'manageChannels', true,
    'manageMessages', true,
    'manageCommunity', true,
    'manageRoles', true,
    'administrator', true,
    'createChannels', true,
    'viewChannels', true,
    'viewMembers', true,
    'inviteMembers', true,
    'banMembers', true,
    'assignRoles', true,
    'manageInvites', true
  ),
  false
from public.communities c
where c.owner_id is not null
  and not exists (
    select 1 from public.community_roles r
    where r.community_id = c.id and lower(trim(r.name)) = 'owner'
  );

with owner_roles as (
  select distinct on (r.community_id) r.community_id, r.id
  from public.community_roles r
  where lower(trim(r.name)) = 'owner'
  order by r.community_id, r.position asc, r.created_at asc, r.id asc
)
insert into public.community_members (community_id, user_id, role_id, is_online, last_seen)
select c.id, c.owner_id, r.id, true, now()
from public.communities c
join owner_roles r on r.community_id = c.id
where c.owner_id is not null
on conflict (community_id, user_id) do update
  set role_id = excluded.role_id,
      is_online = true,
      last_seen = now();

create table if not exists public.community_verification_completions (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  method text not null check (method in ('rules', 'quick', 'picture')),
  role_id uuid references public.community_roles(id) on delete set null,
  status text not null default 'completed' check (status in ('rules_accepted', 'role_selection_pending', 'completed')),
  completed_at timestamptz not null default now(),
  primary key (community_id, user_id, method)
);

alter table public.community_verification_completions
  add column if not exists status text not null default 'completed'
  check (status in ('rules_accepted', 'role_selection_pending', 'completed'));
update public.community_verification_completions
set status = 'role_selection_pending'
where role_id is null and status = 'completed';

create or replace function public.get_effective_community_role_id(
  p_community_id uuid,
  p_user_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cmr.role_id
  from public.community_member_roles cmr
  join public.community_roles r
    on r.id = cmr.role_id and r.community_id = cmr.community_id
  join public.community_members m
    on m.community_id = cmr.community_id and m.user_id = cmr.user_id
  where cmr.community_id = p_community_id and cmr.user_id = p_user_id
  order by case when lower(trim(r.name)) = 'owner' then -1 else r.position end asc, r.created_at asc, r.id asc
  limit 1
$$;

alter table public.community_member_roles enable row level security;

create or replace function public.community_user_can_view_members(
  p_community_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id = auth.uid() and (
    exists (
      select 1
      from public.communities c
      where c.id = p_community_id and c.owner_id = p_user_id
    ) or exists (
      select 1
      from public.community_roles r
      where r.community_id = p_community_id
        and r.id = public.get_effective_community_role_id(p_community_id, p_user_id)
        and coalesce((r.permissions ->> 'viewMembers')::boolean, false)
    )
  )
$$;

drop policy if exists community_member_roles_read_members on public.community_member_roles;
create policy community_member_roles_read_members
  on public.community_member_roles for select
  using (
    user_id = auth.uid()
    or public.community_user_can_view_members(community_id, auth.uid())
  );

insert into public.community_member_roles (community_id, user_id, role_id, assigned_at)
select community_id, user_id, role_id, coalesce(joined_at, now())
from public.community_members
on conflict (community_id, user_id, role_id) do nothing;

create or replace function public.sync_community_member_default_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role_id is not null then
    insert into public.community_member_roles (community_id, user_id, role_id, assigned_at)
    values (new.community_id, new.user_id, new.role_id, coalesce(new.joined_at, now()))
    on conflict (community_id, user_id, role_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists community_member_default_role_assignment on public.community_members;
create trigger community_member_default_role_assignment
  after insert on public.community_members
  for each row execute function public.sync_community_member_default_role();

create or replace function public.sync_community_member_effective_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_community_id uuid;
begin
  if tg_op = 'DELETE' then
    target_community_id := old.community_id;
  else
    target_community_id := new.community_id;
  end if;
  update public.community_members m
  set role_id = public.get_effective_community_role_id(m.community_id, m.user_id)
  where m.community_id = target_community_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists community_member_roles_sync_effective on public.community_member_roles;
create trigger community_member_roles_sync_effective
  after insert or update or delete on public.community_member_roles
  for each row execute function public.sync_community_member_effective_roles();

create or replace function public.sync_community_roles_after_reorder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_members m
  set role_id = public.get_effective_community_role_id(m.community_id, m.user_id)
  where m.community_id = new.community_id
    and exists (
      select 1 from public.community_member_roles cmr
      where cmr.community_id = new.community_id
        and cmr.user_id = m.user_id
        and cmr.role_id = new.id
    );
  return new;
end;
$$;

drop trigger if exists community_roles_sync_member_hierarchy on public.community_roles;
create trigger community_roles_sync_member_hierarchy
  after update of position on public.community_roles
  for each row execute function public.sync_community_roles_after_reorder();

create table if not exists public.community_access_rules (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  target_type text not null check (target_type in ('category', 'channel')),
  target_id uuid not null,
  role_id uuid not null references public.community_roles(id) on delete cascade,
  can_view boolean not null default false,
  can_send boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (target_type, target_id, role_id),
  check (not can_send or can_view)
);

create index if not exists community_access_rules_target_idx
  on public.community_access_rules(community_id, target_type, target_id);

alter table public.community_access_rules enable row level security;

drop policy if exists community_access_rules_members_read on public.community_access_rules;
create policy community_access_rules_members_read
  on public.community_access_rules for select
  using (
    exists (
      select 1 from public.community_members m
      where m.community_id = community_access_rules.community_id and m.user_id = auth.uid()
    )
  );

drop policy if exists community_access_rules_managers_write on public.community_access_rules;
create policy community_access_rules_managers_write
  on public.community_access_rules for all
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_access_rules.community_id and c.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.community_member_roles cmr
      join public.community_roles r on r.id = cmr.role_id
      where cmr.community_id = community_access_rules.community_id
        and cmr.user_id = auth.uid()
        and cmr.role_id = public.get_effective_community_role_id(community_access_rules.community_id, auth.uid())
        and (
          coalesce((r.permissions ->> 'administrator')::boolean, false)
          or coalesce((r.permissions ->> 'manageCommunity')::boolean, false)
          or coalesce((r.permissions ->> 'manageChannels')::boolean, false)
        )
    )
  )
  with check (
    exists (
      select 1 from public.communities c
      where c.id = community_access_rules.community_id and c.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.community_member_roles cmr
      join public.community_roles r on r.id = cmr.role_id
      where cmr.community_id = community_access_rules.community_id
        and cmr.user_id = auth.uid()
        and cmr.role_id = public.get_effective_community_role_id(community_access_rules.community_id, auth.uid())
        and (
          coalesce((r.permissions ->> 'administrator')::boolean, false)
          or coalesce((r.permissions ->> 'manageCommunity')::boolean, false)
          or coalesce((r.permissions ->> 'manageChannels')::boolean, false)
        )
    )
  );

create or replace function public.community_user_can_access_channel(
  p_community_id uuid,
  p_user_id uuid,
  p_channel_id uuid,
  p_action text default 'view'
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  effective_role_id uuid;
  role_permissions jsonb;
  target_channel public.community_channels;
  target_category_id uuid;
  target_type text;
  target_id uuid;
  verification_config jsonb;
  matching_rule record;
  has_rules boolean;
  allowed boolean;
  permission_override text;
  member_access record;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then return false; end if;
  if p_action not in ('view', 'send') then return false; end if;
  select * into target_channel
  from public.community_channels ch
  where ch.id = p_channel_id and ch.community_id = p_community_id and ch.deleted_at is null;
  if not found then return false; end if;
  if exists (
    select 1 from public.communities c
    where c.id = p_community_id and c.owner_id = p_user_id
  ) then return true; end if;
  if not exists (
    select 1 from public.community_members m
    where m.community_id = p_community_id and m.user_id = p_user_id
  ) then return false; end if;
  effective_role_id := public.get_effective_community_role_id(p_community_id, p_user_id);
  if effective_role_id is null then return false; end if;
  select r.permissions into role_permissions
  from public.community_roles r
  where r.id = effective_role_id and r.community_id = p_community_id;

  if coalesce((role_permissions ->> 'administrator')::boolean, false)
    or coalesce((role_permissions ->> 'manageChannels')::boolean, false)
    or coalesce((role_permissions ->> 'manageCommunity')::boolean, false) then
    return true;
  end if;

  select coalesce(settings.config, '{}'::jsonb)
    into verification_config
  from public.community_tool_settings settings
  where settings.community_id = p_community_id
    and settings.tool_type = 'verification'
    and settings.enabled = true;
  if p_action = 'view' and coalesce((verification_config -> 'rulesGate' ->> 'enabled')::boolean, false) then
    if target_channel.id::text = (verification_config -> 'rulesGate' ->> 'rulesChannelId') then
      return true;
    end if;
    if (verification_config -> 'rulesGate' ->> 'flow') = 'rules_then_verify'
      and target_channel.id::text = (verification_config -> 'rulesGate' ->> 'verificationChannelId')
      and exists (
        select 1 from public.community_verification_completions completion
        where completion.community_id = p_community_id
          and completion.user_id = p_user_id
          and completion.method = 'rules'
          and completion.status in ('rules_accepted', 'completed')
      ) then
      return true;
    end if;
  end if;
  select mca.can_view, mca.can_send into member_access
  from public.community_member_channel_access mca
  where mca.community_id = p_community_id and mca.channel_id = p_channel_id and mca.user_id = p_user_id
  limit 1;
  if found then
    return case when p_action = 'view' then member_access.can_view else member_access.can_view and member_access.can_send end;
  end if;

  target_category_id := target_channel.category_id;
  if target_category_id is null and target_channel.category is not null then
    select cc.id into target_category_id
    from public.community_channel_categories cc
    where cc.community_id = p_community_id and cc.name = target_channel.category
    limit 1;
  end if;

  select exists (
    select 1 from public.community_access_rules ar
    where ar.community_id = p_community_id
      and ar.target_type = 'channel' and ar.target_id = p_channel_id
  ) into has_rules;
  if has_rules then
    target_type := 'channel';
    target_id := p_channel_id;
  elsif target_category_id is not null and exists (
    select 1 from public.community_access_rules ar
    where ar.community_id = p_community_id
      and ar.target_type = 'category' and ar.target_id = target_category_id
  ) then
    target_type := 'category';
    target_id := target_category_id;
    has_rules := true;
  end if;

  if has_rules then
    select ar.can_view, ar.can_send into matching_rule
    from public.community_access_rules ar
    where ar.community_id = p_community_id
      and ar.target_type = target_type and ar.target_id = target_id
      and ar.role_id = effective_role_id
    limit 1;
    if not found then return false; end if;
    allowed := case when p_action = 'view' then matching_rule.can_view else matching_rule.can_view and matching_rule.can_send end;
    if not allowed then return false; end if;
  else
    select cpo.state into permission_override
    from public.channel_permission_overrides cpo
    where cpo.community_id = p_community_id and cpo.channel_id = p_channel_id
      and cpo.role_id = effective_role_id and cpo.permission = 'viewChannel'
    limit 1;
    if permission_override is null and target_category_id is not null then
      select cpo.state into permission_override
      from public.category_permission_overrides cpo
      where cpo.community_id = p_community_id and cpo.category_id = target_category_id
        and cpo.role_id = effective_role_id and cpo.permission = 'viewChannel'
        and cpo.apply_to_channels = true
      limit 1;
    end if;
    if permission_override = 'deny' then return false; end if;
    allowed := permission_override = 'allow'
      or (coalesce((role_permissions ->> 'viewChannels')::boolean, false)
        and not coalesce(target_channel.is_private, false));
    if not allowed then return false; end if;
    if p_action = 'view' then return true; end if;

    select cpo.state into permission_override
    from public.channel_permission_overrides cpo
    where cpo.community_id = p_community_id and cpo.channel_id = p_channel_id
      and cpo.role_id = effective_role_id and cpo.permission = 'sendMessages'
    limit 1;
    if permission_override is null and target_category_id is not null then
      select cpo.state into permission_override
      from public.category_permission_overrides cpo
      where cpo.community_id = p_community_id and cpo.category_id = target_category_id
        and cpo.role_id = effective_role_id and cpo.permission = 'sendMessages'
        and cpo.apply_to_channels = true
      limit 1;
    end if;
    if permission_override = 'deny' then return false; end if;
    return permission_override = 'allow'
      or coalesce((role_permissions ->> 'sendMessages')::boolean, false);
  end if;

  if p_action = 'send' then
    select cpo.state into permission_override
    from public.channel_permission_overrides cpo
    where cpo.community_id = p_community_id and cpo.channel_id = p_channel_id
      and cpo.role_id = effective_role_id and cpo.permission = 'sendMessages'
    limit 1;
    if permission_override = 'deny' then return false; end if;
    if permission_override = 'allow' then return true; end if;
    if target_category_id is not null then
      select cpo.state into permission_override
      from public.category_permission_overrides cpo
      where cpo.community_id = p_community_id and cpo.category_id = target_category_id
        and cpo.role_id = effective_role_id and cpo.permission = 'sendMessages'
        and cpo.apply_to_channels = true
      limit 1;
      if permission_override = 'deny' then return false; end if;
      if permission_override = 'allow' then return true; end if;
    end if;
  else
    select cpo.state into permission_override
    from public.channel_permission_overrides cpo
    where cpo.community_id = p_community_id and cpo.channel_id = p_channel_id
      and cpo.role_id = effective_role_id and cpo.permission = 'viewChannel'
    limit 1;
    if permission_override = 'deny' then return false; end if;
    if permission_override = 'allow' then return true; end if;
    if target_category_id is not null then
      select cpo.state into permission_override
      from public.category_permission_overrides cpo
      where cpo.community_id = p_community_id and cpo.category_id = target_category_id
        and cpo.role_id = effective_role_id and cpo.permission = 'viewChannel'
        and cpo.apply_to_channels = true
      limit 1;
      if permission_override = 'deny' then return false; end if;
      if permission_override = 'allow' then return true; end if;
    end if;
  end if;
  return true;
end;
$$;

create or replace function public.community_user_can_manage_messages(
  p_community_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = p_user_id and (
    exists (
      select 1 from public.communities c
      where c.id = p_community_id and c.owner_id = p_user_id
    ) or exists (
      select 1
      from public.community_member_roles cmr
      join public.community_roles r on r.id = cmr.role_id
      where cmr.community_id = p_community_id
        and cmr.user_id = p_user_id
        and cmr.role_id = public.get_effective_community_role_id(p_community_id, p_user_id)
        and (
          coalesce((r.permissions ->> 'administrator')::boolean, false)
          or coalesce((r.permissions ->> 'manageMessages')::boolean, false)
        )
    )
  )
$$;

alter table public.community_channels enable row level security;
drop policy if exists community_channels_effective_role_read on public.community_channels;
create policy community_channels_effective_role_read
  on public.community_channels for select to authenticated
  using (public.community_user_can_access_channel(community_id, auth.uid(), id, 'view'));
drop policy if exists community_channels_effective_role_access on public.community_channels;
create policy community_channels_effective_role_access
  on public.community_channels as restrictive for select to authenticated
  using (
    public.community_user_can_access_channel(community_id, auth.uid(), id, 'view')
  );
drop policy if exists community_channels_manager_write on public.community_channels;
create policy community_channels_manager_write
  on public.community_channels for all to authenticated
  using (
    exists (select 1 from public.communities c where c.id = community_channels.community_id and c.owner_id = auth.uid())
    or exists (
      select 1 from public.community_member_roles cmr
      join public.community_roles r on r.id = cmr.role_id
      where cmr.community_id = community_channels.community_id and cmr.user_id = auth.uid()
        and cmr.role_id = public.get_effective_community_role_id(community_channels.community_id, auth.uid())
        and (
          coalesce((r.permissions ->> 'administrator')::boolean, false)
          or coalesce((r.permissions ->> 'manageCommunity')::boolean, false)
          or coalesce((r.permissions ->> 'manageChannels')::boolean, false)
        )
    )
  )
  with check (
    exists (select 1 from public.communities c where c.id = community_channels.community_id and c.owner_id = auth.uid())
    or exists (
      select 1 from public.community_member_roles cmr
      join public.community_roles r on r.id = cmr.role_id
      where cmr.community_id = community_channels.community_id and cmr.user_id = auth.uid()
        and cmr.role_id = public.get_effective_community_role_id(community_channels.community_id, auth.uid())
        and (
          coalesce((r.permissions ->> 'administrator')::boolean, false)
          or coalesce((r.permissions ->> 'manageCommunity')::boolean, false)
          or coalesce((r.permissions ->> 'manageChannels')::boolean, false)
        )
    )
  );

alter table public.community_messages enable row level security;
drop policy if exists community_messages_effective_role_read on public.community_messages;
create policy community_messages_effective_role_read
  on public.community_messages for select to authenticated
  using (
    public.community_user_can_access_channel(
      (select ch.community_id from public.community_channels ch where ch.id = community_messages.channel_id),
      auth.uid(),
      community_messages.channel_id,
      'view'
    )
  );
drop policy if exists community_messages_effective_role_access on public.community_messages;
create policy community_messages_effective_role_access
  on public.community_messages as restrictive for select to authenticated
  using (
    exists (
      select 1 from public.community_channels ch
      where ch.id = community_messages.channel_id
        and public.community_user_can_access_channel(ch.community_id, auth.uid(), ch.id, 'view')
    )
  );
drop policy if exists community_messages_author_or_manager_update on public.community_messages;
create policy community_messages_author_or_manager_update
  on public.community_messages for update to authenticated
  using (
    (user_id = auth.uid() and public.community_user_can_access_channel(
      (select ch.community_id from public.community_channels ch where ch.id = community_messages.channel_id),
      auth.uid(), channel_id, 'send'
    ))
    or exists (
      select 1 from public.community_channels ch
      where ch.id = community_messages.channel_id
        and public.community_user_can_manage_messages(ch.community_id, auth.uid())
    )
  )
  with check (
    (user_id = auth.uid() and public.community_user_can_access_channel(
      (select ch.community_id from public.community_channels ch where ch.id = community_messages.channel_id),
      auth.uid(), channel_id, 'send'
    ))
    or exists (
      select 1 from public.community_channels ch
      where ch.id = community_messages.channel_id
        and public.community_user_can_manage_messages(ch.community_id, auth.uid())
    )
  );
drop policy if exists community_messages_author_or_manager_delete on public.community_messages;
create policy community_messages_author_or_manager_delete
  on public.community_messages for delete to authenticated
  using (
    (user_id = auth.uid() and public.community_user_can_access_channel(
      (select ch.community_id from public.community_channels ch where ch.id = community_messages.channel_id),
      auth.uid(), channel_id, 'send'
    ))
    or exists (
      select 1 from public.community_channels ch
      where ch.id = community_messages.channel_id
        and public.community_user_can_manage_messages(ch.community_id, auth.uid())
    )
  );

create or replace function public.send_community_message(
  p_channel_id uuid,
  p_user_id uuid,
  p_content text,
  p_reply_to_id uuid default null,
  p_attachments jsonb default '[]'::jsonb
)
returns public.community_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  new_message public.community_messages;
  moderation_result jsonb;
  target_channel public.community_channels;
  member_role_id uuid;
  role_permissions jsonb := '{}'::jsonb;
  attachment_allowed boolean := false;
  channel_override text;
  category_override text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  if nullif(trim(p_content), '') is null and jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) = 0 then
    raise exception 'Message cannot be empty';
  end if;

  select * into target_channel
  from public.community_channels
  where id = p_channel_id and deleted_at is null;
  if not found then raise exception 'Channel not found'; end if;

  select public.get_effective_community_role_id(target_channel.community_id, p_user_id)
    into member_role_id;
  if member_role_id is null then raise exception 'You are not a member of this community'; end if;
  if not public.community_user_can_access_channel(target_channel.community_id, p_user_id, p_channel_id, 'send') then
    raise exception 'You do not have permission to send messages in this channel';
  end if;

  if jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) > 0 then
    if exists (select 1 from public.communities c where c.id = target_channel.community_id and c.owner_id = p_user_id) then
      attachment_allowed := true;
    else
      select r.permissions into role_permissions
      from public.community_roles r where r.id = member_role_id;
      attachment_allowed := coalesce((role_permissions->>'administrator')::boolean, false)
        or coalesce((role_permissions->>'attachFiles')::boolean, false)
        or coalesce((role_permissions->>'manageChannels')::boolean, false);

      select cpo.state into channel_override
      from public.channel_permission_overrides cpo
      where cpo.channel_id = p_channel_id and cpo.role_id = member_role_id and cpo.permission = 'attachFiles'
      limit 1;
      if channel_override = 'deny' and not coalesce((role_permissions->>'administrator')::boolean, false)
        and not coalesce((role_permissions->>'manageChannels')::boolean, false) then attachment_allowed := false;
      elsif channel_override = 'allow' then attachment_allowed := true;
      end if;

      if target_channel.category is not null then
        select cpo.state into category_override
        from public.category_permission_overrides cpo
        join public.community_channel_categories cc on cc.id = cpo.category_id
        where cc.community_id = target_channel.community_id
          and cc.name = target_channel.category
          and cpo.role_id = member_role_id
          and cpo.permission = 'attachFiles'
          and cpo.apply_to_channels = true
        limit 1;
        if category_override = 'deny'
          and not coalesce((role_permissions->>'administrator')::boolean, false)
          and not coalesce((role_permissions->>'manageChannels')::boolean, false) then attachment_allowed := false;
        elsif category_override = 'allow' then attachment_allowed := true;
        end if;
      end if;
    end if;
    if not attachment_allowed then raise exception 'You do not have permission to upload files in this channel'; end if;
  end if;

  moderation_result := public.moderate_community_message(p_channel_id, p_user_id, trim(coalesce(p_content, 'Attachment')));
  if coalesce((moderation_result->>'allowed')::boolean, true) = false then
    raise exception 'Message blocked by moderation: %', coalesce(moderation_result->>'reason', 'community rule');
  end if;

  insert into public.community_messages (channel_id, user_id, content, reply_to_id, attachments)
  values (p_channel_id, p_user_id, coalesce(nullif(trim(p_content), ''), 'Attachment'), p_reply_to_id, coalesce(p_attachments, '[]'::jsonb))
  returning * into new_message;
  return new_message;
end;
$$;

create or replace function public.update_community_message_reaction(
  p_message_id uuid,
  p_user_id uuid,
  p_emoji text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  message_row public.community_messages;
  current_reactions jsonb;
  current_users jsonb;
  role_id uuid;
  role_permissions jsonb;
  override_state text;
  category_id uuid;
  is_community_owner boolean;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  if p_action not in ('add', 'remove') or nullif(trim(p_emoji), '') is null then
    raise exception 'Invalid reaction';
  end if;
  select * into message_row from public.community_messages where id = p_message_id for update;
  if not found or message_row.deleted_at is not null then raise exception 'Message not found'; end if;
  select ch.category_id into category_id from public.community_channels ch where ch.id = message_row.channel_id;
  if not public.community_user_can_access_channel(
    (select ch.community_id from public.community_channels ch where ch.id = message_row.channel_id),
    p_user_id,
    message_row.channel_id,
    'view'
  ) then raise exception 'You cannot view this channel'; end if;

  role_id := public.get_effective_community_role_id(
    (select ch.community_id from public.community_channels ch where ch.id = message_row.channel_id),
    p_user_id
  );
  select r.permissions into role_permissions from public.community_roles r where r.id = role_id;
  select exists (
    select 1 from public.communities c
    where c.id = (select ch.community_id from public.community_channels ch where ch.id = message_row.channel_id)
      and c.owner_id = p_user_id
  ) into is_community_owner;
  select cpo.state into override_state from public.channel_permission_overrides cpo
  where cpo.channel_id = message_row.channel_id and cpo.role_id = role_id and cpo.permission = 'addReactions'
  limit 1;
  if override_state is null and category_id is not null then
    select cpo.state into override_state from public.category_permission_overrides cpo
    where cpo.category_id = category_id and cpo.role_id = role_id and cpo.permission = 'addReactions'
      and cpo.apply_to_channels = true
    limit 1;
  end if;
  if override_state = 'deny'
    and not coalesce((role_permissions ->> 'administrator')::boolean, false) then
    raise exception 'Reactions are disabled in this channel';
  end if;
  if not coalesce(is_community_owner, false)
    and override_state is distinct from 'allow'
    and not coalesce((role_permissions ->> 'administrator')::boolean, false)
    and not coalesce((role_permissions ->> 'addReactions')::boolean, false) then
    raise exception 'You do not have permission to add reactions';
  end if;

  current_reactions := coalesce(message_row.reactions, '{}'::jsonb);
  current_users := coalesce(current_reactions -> p_emoji -> 'users', '[]'::jsonb);
  if p_action = 'add' then
    if not (current_users @> jsonb_build_array(p_user_id::text)) then
      current_users := current_users || jsonb_build_array(p_user_id::text);
      current_reactions := jsonb_set(
        current_reactions,
        array[p_emoji],
        jsonb_build_object('count', jsonb_array_length(current_users), 'users', current_users),
        true
      );
    end if;
  else
    select coalesce(jsonb_agg(to_jsonb(entry.user_id)), '[]'::jsonb)
      into current_users
    from jsonb_array_elements_text(current_users) as entry(user_id)
    where entry.user_id <> p_user_id::text;
    if jsonb_array_length(current_users) = 0 then
      current_reactions := current_reactions - p_emoji;
    else
      current_reactions := jsonb_set(
        current_reactions,
        array[p_emoji],
        jsonb_build_object('count', jsonb_array_length(current_users), 'users', current_users),
        true
      );
    end if;
  end if;

  update public.community_messages
  set reactions = current_reactions, updated_at = now()
  where id = p_message_id;
  return current_reactions;
end;
$$;
revoke all on function public.update_community_message_reaction(uuid, uuid, text, text) from public;
grant execute on function public.update_community_message_reaction(uuid, uuid, text, text) to authenticated;

create or replace function public.assign_community_member_role(
  p_community_id uuid,
  p_user_id uuid,
  p_role_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_owner_id uuid;
  actor_role_id uuid;
  actor_role public.community_roles;
  target_role public.community_roles;
  effective_role_id uuid;
begin
  if actor_id is null then raise exception 'Unauthorized'; end if;
  select owner_id into actor_owner_id
  from public.communities where id = p_community_id;
  if not found then raise exception 'Community not found'; end if;
  if p_user_id = actor_owner_id then raise exception 'The community owner role is protected'; end if;
  if not exists (
    select 1 from public.community_members
    where community_id = p_community_id and user_id = p_user_id
  ) then raise exception 'Community member not found'; end if;

  select * into target_role
  from public.community_roles
  where id = p_role_id and community_id = p_community_id;
  if not found then raise exception 'Role does not belong to this community'; end if;

  if target_role.is_default then
    raise exception 'The default role is assigned automatically and cannot be granted manually';
  end if;
  if lower(trim(target_role.name)) = 'owner' then
    raise exception 'The Owner role is protected';
  end if;

  if actor_id <> actor_owner_id then
    if p_user_id = actor_owner_id or lower(trim(target_role.name)) = 'owner' then
      raise exception 'The community owner role is protected';
    end if;

    actor_role_id := public.get_effective_community_role_id(p_community_id, actor_id);
    select * into actor_role from public.community_roles where id = actor_role_id;
    if actor_role_id is null or not coalesce((actor_role.permissions ->> 'assignRoles')::boolean, false) then
      raise exception 'You do not have permission to assign roles';
    end if;
    if actor_role.position >= target_role.position then
      raise exception 'You can only assign roles ranked below your highest role';
    end if;
  end if;

  insert into public.community_member_roles (community_id, user_id, role_id, assigned_by)
  values (p_community_id, p_user_id, p_role_id, actor_id)
  on conflict (community_id, user_id, role_id) do nothing;

  effective_role_id := public.get_effective_community_role_id(p_community_id, p_user_id);
  update public.community_members
  set role_id = effective_role_id
  where community_id = p_community_id and user_id = p_user_id;

  return jsonb_build_object('success', true, 'effective_role_id', effective_role_id);
end;
$$;

create or replace function public.remove_community_member_role(
  p_community_id uuid,
  p_user_id uuid,
  p_role_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  owner_id uuid;
  target_role public.community_roles;
  actor_role public.community_roles;
  actor_role_id uuid;
  effective_role_id uuid;
begin
  if actor_id is null then raise exception 'Unauthorized'; end if;
  select c.owner_id into owner_id from public.communities c where c.id = p_community_id;
  if not found then raise exception 'Community not found'; end if;
  select * into target_role from public.community_roles where id = p_role_id and community_id = p_community_id;
  if not found then raise exception 'Role not found'; end if;
  if p_user_id = owner_id or target_role.is_default or lower(trim(target_role.name)) = 'owner' then
    raise exception 'This role assignment is protected';
  end if;
  if actor_id <> owner_id then
    actor_role_id := public.get_effective_community_role_id(p_community_id, actor_id);
    select * into actor_role from public.community_roles where id = actor_role_id;
    if actor_role_id is null
      or not coalesce((actor_role.permissions ->> 'assignRoles')::boolean, false)
      or actor_role.position >= target_role.position then
      raise exception 'You do not have permission to remove this role';
    end if;
  end if;

  delete from public.community_member_roles
  where community_id = p_community_id and user_id = p_user_id and role_id = p_role_id;

  effective_role_id := public.get_effective_community_role_id(p_community_id, p_user_id);
  update public.community_members
  set role_id = effective_role_id
  where community_id = p_community_id and user_id = p_user_id;
  return jsonb_build_object('success', true, 'effective_role_id', effective_role_id);
end;
$$;

alter table public.community_verification_completions enable row level security;

drop policy if exists community_verification_completions_read_own on public.community_verification_completions;
create policy community_verification_completions_read_own
  on public.community_verification_completions for select
  using (user_id = auth.uid());

create or replace function public.get_verification_panel(p_community_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  settings_row public.community_tool_settings;
  completion_rows jsonb;
  public_config jsonb;
  picture_cards jsonb;
  picture_correct_id text;
  picture_target_label text;
begin
  if auth.uid() is null or (
    not exists (
      select 1 from public.community_members
      where community_id = p_community_id and user_id = auth.uid()
    )
    and not exists (
      select 1 from public.communities
      where id = p_community_id and owner_id = auth.uid()
    )
  ) then
    raise exception 'Community membership required';
  end if;

  select * into settings_row
  from public.community_tool_settings
  where community_id = p_community_id and tool_type = 'verification';

  public_config := coalesce(settings_row.config, '{}'::jsonb);
  picture_correct_id := coalesce(
    public_config -> 'methods' -> 'picture' ->> 'correctId',
    public_config -> 'challenge' ->> 'correctId',
    public_config -> 'picture' ->> 'correctAnswer',
    ''
  );
  picture_cards := coalesce(
    public_config -> 'methods' -> 'picture' -> 'cards',
    public_config -> 'challenge' -> 'cards',
    public_config -> 'picture' -> 'cards',
    '[]'::jsonb
  );
  if jsonb_typeof(picture_cards) <> 'array' then picture_cards := '[]'::jsonb; end if;
  select card ->> 'label' into picture_target_label
  from jsonb_array_elements(picture_cards) as entries(card)
  where card ->> 'id' = picture_correct_id
    and nullif(card ->> 'image', '') is not null
    and nullif(trim(card ->> 'label'), '') is not null
  limit 1;
  public_config := public_config
    #- '{methods,picture,correctId}'
    #- '{challenge,correctId}'
    #- '{picture,correctId}'
    #- '{picture,correctAnswer}';

  select coalesce(jsonb_agg(jsonb_build_object('method', method, 'completed_at', completed_at, 'role_id', role_id, 'status', status)), '[]'::jsonb)
    into completion_rows
  from public.community_verification_completions
  where community_id = p_community_id and user_id = auth.uid();

  return jsonb_build_object(
    'configured', coalesce(settings_row.enabled, false),
    'config', public_config,
    'picture_challenge_ready', picture_target_label is not null
      and (select count(*) from jsonb_array_elements(picture_cards) as entries(card)
        where nullif(card ->> 'image', '') is not null
          and nullif(trim(card ->> 'label'), '') is not null) >= 2,
    'picture_target_label', picture_target_label,
    'completions', completion_rows
  );
end;
$$;

create or replace function public.complete_community_verification(
  p_community_id uuid,
  p_method text,
  p_answer text default null,
  p_accepted boolean default false,
  p_role_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  method_key text;
  settings_row public.community_tool_settings;
  method_config jsonb;
  role_grant jsonb;
  allowed_role_ids jsonb;
  selected_role_id uuid;
  target_role public.community_roles;
  target_member_role uuid;
  community_owner_id uuid;
  answer_expected text;
  profile_row public.profiles;
  minimum_age integer;
  default_role_position integer;
  pending_completion boolean := false;
  pending_role_id uuid;
  completion_status text;
  completion_exists boolean := false;
  rules_gate jsonb;
  rules_flow text;
  rules_accepted boolean := false;
begin
  if auth.uid() is null then return jsonb_build_object('success', false, 'error', 'Unauthorized'); end if;
  method_key := case p_method when 'rules_gate' then 'rules' else p_method end;
  if method_key not in ('rules', 'quick', 'picture') then
    return jsonb_build_object('success', false, 'error', 'Verification method is not enabled');
  end if;

  select * into settings_row
  from public.community_tool_settings
  where community_id = p_community_id and tool_type = 'verification';
  if not found or not coalesce(settings_row.enabled, false) then
    return jsonb_build_object('success', false, 'error', 'Verification is not enabled for this community');
  end if;
  if not exists (
    select 1 from public.community_members
    where community_id = p_community_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('success', false, 'error', 'Community membership not found');
  end if;

  method_config := settings_row.config -> 'methods' -> method_key;
  if method_config is null then
    if method_key = 'quick' then
      method_config := jsonb_build_object('enabled', coalesce((settings_row.config ->> 'quickEnabled')::boolean, false));
    elsif method_key = 'picture' then
      method_config := jsonb_build_object('enabled', coalesce((settings_row.config ->> 'pictureEnabled')::boolean, false));
    else
      method_config := jsonb_build_object('enabled', coalesce((settings_row.config ->> 'rulesEnabled')::boolean, false));
    end if;
  end if;
  if not coalesce((method_config ->> 'enabled')::boolean, false) then
    return jsonb_build_object('success', false, 'error', 'This verification method is disabled');
  end if;

  rules_gate := coalesce(settings_row.config -> 'rulesGate', '{}'::jsonb);
  rules_flow := coalesce(rules_gate ->> 'flow', 'rules_only');
  if coalesce((rules_gate ->> 'enabled')::boolean, false) then
    if rules_flow not in ('rules_only', 'rules_then_verify')
      or nullif(rules_gate ->> 'rulesChannelId', '') is null then
      return jsonb_build_object('success', false, 'error', 'The community rules gate is not configured correctly.');
    end if;
    if rules_flow = 'rules_then_verify' and (
      nullif(rules_gate ->> 'verificationChannelId', '') is null
      or rules_gate ->> 'verificationChannelId' = rules_gate ->> 'rulesChannelId'
      or coalesce(rules_gate ->> 'secondMethod', '') not in ('quick', 'picture')
    ) then
      return jsonb_build_object('success', false, 'error', 'The second verification step is not configured correctly.');
    end if;
    if rules_flow = 'rules_only' and method_key <> 'rules' then
      return jsonb_build_object('success', false, 'error', 'Complete the rules gate before requesting access.');
    end if;
    if rules_flow = 'rules_then_verify' and method_key <> 'rules'
      and method_key <> coalesce(rules_gate ->> 'secondMethod', 'quick') then
      return jsonb_build_object('success', false, 'error', 'This is not the verification step configured for this community.');
    end if;
    if rules_flow = 'rules_then_verify' and method_key <> 'rules' then
      select exists (
        select 1 from public.community_verification_completions
        where community_id = p_community_id and user_id = auth.uid()
          and method = 'rules' and status in ('rules_accepted', 'completed')
      ) into rules_accepted;
      if not rules_accepted then
        return jsonb_build_object('success', false, 'error', 'Accept the community rules before continuing.');
      end if;
    end if;
  end if;

  select role_id, status into pending_role_id, completion_status
  from public.community_verification_completions
  where community_id = p_community_id and user_id = auth.uid() and method = method_key;
  completion_exists := found;
  if completion_exists and completion_status = 'completed' then
    return jsonb_build_object('success', true, 'already_completed', true, 'role_id', pending_role_id, 'method', method_key);
  end if;
  pending_completion := completion_exists and completion_status = 'role_selection_pending';

  if not pending_completion and method_key = 'rules' and not coalesce(p_accepted, false) then
    return jsonb_build_object('success', false, 'error', 'You must accept the rules before continuing.');
  elsif not pending_completion and method_key = 'picture' then
    answer_expected := coalesce(
      method_config ->> 'correctId',
      settings_row.config -> 'challenge' ->> 'correctId',
      settings_row.config -> 'picture' ->> 'correctAnswer',
      ''
    );
    if answer_expected = '' or lower(trim(coalesce(p_answer, ''))) <> lower(trim(answer_expected)) then
      return jsonb_build_object('success', false, 'error', 'Picture challenge answer is incorrect.');
    end if;
  elsif not pending_completion and method_key = 'quick' then
    select * into profile_row from public.profiles where id = auth.uid();
    minimum_age := greatest(0, coalesce((method_config ->> 'minAccountAgeDays')::integer, 0));
    if minimum_age > 0 and profile_row.created_at > now() - make_interval(days => minimum_age) then
      return jsonb_build_object('success', false, 'error', 'Your account does not meet the minimum age requirement.');
    end if;
    if coalesce((method_config ->> 'requireAvatar')::boolean, false)
      and nullif(trim(coalesce(profile_row.avatar_id, '')), '') is null then
      return jsonb_build_object('success', false, 'error', 'Add a profile picture before verifying.');
    end if;
    if coalesce((method_config ->> 'requireProfileVerified')::boolean, false)
      and not coalesce(profile_row.verified, false) then
      return jsonb_build_object('success', false, 'error', 'Your profile must be verified first.');
    end if;
  end if;

  select c.owner_id into community_owner_id from public.communities c where c.id = p_community_id;
  if community_owner_id = auth.uid() then
    return jsonb_build_object('success', true, 'preserved_role', true, 'message', 'Community owner role preserved.');
  end if;

  if coalesce((rules_gate ->> 'enabled')::boolean, false)
    and rules_flow = 'rules_then_verify'
    and method_key = 'rules' then
    insert into public.community_verification_completions (community_id, user_id, method, role_id, status)
    values (p_community_id, auth.uid(), method_key, null, 'rules_accepted')
    on conflict (community_id, user_id, method) do update
      set role_id = null, status = 'rules_accepted', completed_at = now();
    return jsonb_build_object('success', true, 'rules_accepted', true, 'method', method_key);
  end if;

  role_grant := coalesce(settings_row.config -> 'roleGrant', '{}'::jsonb);
  allowed_role_ids := coalesce(role_grant -> 'roleIds', '[]'::jsonb);
  if not coalesce((role_grant ->> 'enabled')::boolean, false) then
    allowed_role_ids := '[]'::jsonb;
  end if;
  if jsonb_typeof(allowed_role_ids) <> 'array' then
    allowed_role_ids := '[]'::jsonb;
  end if;
  if jsonb_array_length(allowed_role_ids) = 0 then
    if method_config ->> 'roleId' is not null then
      allowed_role_ids := jsonb_build_array(method_config ->> 'roleId');
    elsif role_grant ->> 'roleId' is not null then
      allowed_role_ids := jsonb_build_array(role_grant ->> 'roleId');
    else
      select id into target_member_role
      from public.community_roles
      where community_id = p_community_id and lower(trim(name)) = 'member'
      order by position asc limit 1;
      if target_member_role is not null then allowed_role_ids := jsonb_build_array(target_member_role::text); end if;
    end if;
  end if;
  if jsonb_array_length(allowed_role_ids) = 0 then
    return jsonb_build_object('success', false, 'error', 'The owner has not configured any roles to grant.');
  end if;

  selected_role_id := p_role_id;
  if selected_role_id is null
    and jsonb_array_length(allowed_role_ids) = 1
    and not coalesce((role_grant ->> 'enabled')::boolean, false) then
    selected_role_id := (allowed_role_ids ->> 0)::uuid;
  end if;
  if selected_role_id is null and (
    jsonb_array_length(allowed_role_ids) > 1
    or (
      coalesce((role_grant ->> 'enabled')::boolean, false)
      and jsonb_array_length(allowed_role_ids) > 0
    )
  ) then
    insert into public.community_verification_completions (community_id, user_id, method, role_id, status)
    values (p_community_id, auth.uid(), method_key, null, 'role_selection_pending')
    on conflict (community_id, user_id, method) do update
      set role_id = null, status = 'role_selection_pending', completed_at = now();
    return jsonb_build_object('success', true, 'needs_role_selection', true, 'method', method_key);
  end if;
  if selected_role_id is null or not (allowed_role_ids @> jsonb_build_array(selected_role_id::text)) then
    return jsonb_build_object('success', false, 'error', 'Choose one of the roles configured by the community owner.');
  end if;

  select position into default_role_position
  from public.community_roles
  where community_id = p_community_id and is_default = true
  order by position asc
  limit 1;
  select * into target_role from public.community_roles
  where id = selected_role_id and community_id = p_community_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'The selected role is no longer available.');
  end if;
  if target_role.is_default or lower(trim(target_role.name)) = 'owner'
    or coalesce((target_role.permissions ->> 'administrator')::boolean, false)
    or coalesce((target_role.permissions ->> 'manageRoles')::boolean, false)
    or coalesce((target_role.permissions ->> 'assignRoles')::boolean, false)
    or coalesce((target_role.permissions ->> 'manageCommunity')::boolean, false)
    or coalesce((target_role.permissions ->> 'manageChannels')::boolean, false)
    or coalesce((target_role.permissions ->> 'kickMembers')::boolean, false)
    or coalesce((target_role.permissions ->> 'banMembers')::boolean, false) then
    return jsonb_build_object('success', false, 'error', 'This role cannot be granted through verification.');
  end if;
  if default_role_position is not null and target_role.position >= default_role_position then
    return jsonb_build_object('success', false, 'error', 'Place selectable verification roles above the default member role in the role hierarchy.');
  end if;

  insert into public.community_member_roles (community_id, user_id, role_id, assigned_by)
  values (p_community_id, auth.uid(), selected_role_id, null)
  on conflict (community_id, user_id, role_id) do nothing;

  target_member_role := public.get_effective_community_role_id(p_community_id, auth.uid());
  update public.community_members
  set role_id = target_member_role
  where community_id = p_community_id and user_id = auth.uid();

  insert into public.community_verification_completions (community_id, user_id, method, role_id, status)
  values (p_community_id, auth.uid(), method_key, selected_role_id, 'completed')
  on conflict (community_id, user_id, method) do update
    set role_id = excluded.role_id, status = 'completed', completed_at = now();

  return jsonb_build_object(
    'success', true,
    'role_id', selected_role_id,
    'effective_role_id', target_member_role,
    'method', method_key
  );
end;
$$;

alter function public.get_effective_community_role_id(uuid, uuid) owner to postgres;
alter function public.community_user_can_view_members(uuid, uuid) owner to postgres;
alter function public.community_user_can_access_channel(uuid, uuid, uuid, text) owner to postgres;
alter function public.community_user_can_manage_messages(uuid, uuid) owner to postgres;
alter function public.assign_community_member_role(uuid, uuid, uuid) owner to postgres;
alter function public.remove_community_member_role(uuid, uuid, uuid) owner to postgres;
alter function public.send_community_message(uuid, uuid, text, uuid, jsonb) owner to postgres;
alter function public.update_community_message_reaction(uuid, uuid, text, text) owner to postgres;
alter function public.get_verification_panel(uuid) owner to postgres;
alter function public.complete_community_verification(uuid, text, text, boolean, uuid) owner to postgres;
revoke all on function public.get_effective_community_role_id(uuid, uuid) from public;
revoke all on function public.community_user_can_view_members(uuid, uuid) from public;
revoke all on function public.community_user_can_access_channel(uuid, uuid, uuid, text) from public;
revoke all on function public.community_user_can_manage_messages(uuid, uuid) from public;
revoke all on function public.assign_community_member_role(uuid, uuid, uuid) from public;
revoke all on function public.remove_community_member_role(uuid, uuid, uuid) from public;
revoke all on function public.send_community_message(uuid, uuid, text, uuid, jsonb) from public;
revoke all on function public.update_community_message_reaction(uuid, uuid, text, text) from public;
revoke all on function public.get_verification_panel(uuid) from public;
revoke all on function public.complete_community_verification(uuid, text, text, boolean, uuid) from public;
grant execute on function public.get_effective_community_role_id(uuid, uuid) to authenticated;
grant execute on function public.community_user_can_view_members(uuid, uuid) to authenticated;
grant execute on function public.community_user_can_access_channel(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.community_user_can_manage_messages(uuid, uuid) to authenticated;
grant execute on function public.assign_community_member_role(uuid, uuid, uuid) to authenticated;
grant execute on function public.remove_community_member_role(uuid, uuid, uuid) to authenticated;
grant execute on function public.send_community_message(uuid, uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.update_community_message_reaction(uuid, uuid, text, text) to authenticated;
grant execute on function public.get_verification_panel(uuid) to authenticated;
grant execute on function public.complete_community_verification(uuid, text, text, boolean, uuid) to authenticated;
