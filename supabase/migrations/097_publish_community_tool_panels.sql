create table if not exists public.community_tool_panel_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  tool_type text not null check (tool_type in ('verification', 'rules', 'tickets')),
  published_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, tool_type)
);

create index if not exists community_tool_panel_posts_channel_idx
  on public.community_tool_panel_posts(channel_id, created_at);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'community_tool_panel_posts'
    ) then
    alter publication supabase_realtime add table public.community_tool_panel_posts;
  end if;
end;
$$;

alter table public.community_tool_panel_posts enable row level security;

revoke all on public.community_tool_panel_posts from anon, authenticated;
grant select on public.community_tool_panel_posts to authenticated;

drop policy if exists "Members can view published community tool panels"
  on public.community_tool_panel_posts;
create policy "Members can view published community tool panels"
  on public.community_tool_panel_posts
  for select
  to authenticated
  using (
    public.community_user_can_access_channel(
      community_id,
      auth.uid(),
      channel_id,
      'view'
    )
  );

create or replace function public.publish_community_tool_panel(
  p_community_id uuid,
  p_channel_id uuid,
  p_tool_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_row public.community_tool_settings;
  target_channel public.community_channels;
  effective_role_id uuid;
  role_permissions jsonb;
  panel_id uuid;
  rules_gate jsonb;
  methods jsonb;
  selected_channels jsonb;
  routed_method text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before publishing a tool panel';
  end if;
  if p_tool_type is null or p_tool_type not in ('verification', 'rules', 'tickets') then
    raise exception 'Unsupported community tool panel';
  end if;

  select * into target_channel
  from public.community_channels
  where id = p_channel_id
    and community_id = p_community_id
    and deleted_at is null
    and type <> 'voice';
  if not found then
    raise exception 'Choose an active text channel in this community';
  end if;

  if not exists (
    select 1
    from public.communities c
    where c.id = p_community_id and c.owner_id = auth.uid()
  ) then
    if not exists (
      select 1 from public.community_members
      where community_id = p_community_id and user_id = auth.uid()
    ) then
      raise exception 'Community membership required';
    end if;
    effective_role_id := public.get_effective_community_role_id(p_community_id, auth.uid());
    select permissions into role_permissions
    from public.community_roles
    where id = effective_role_id and community_id = p_community_id;
    if not (
      coalesce((role_permissions ->> 'administrator')::boolean, false)
      or coalesce((role_permissions ->> 'manageChannels')::boolean, false)
      or coalesce((role_permissions ->> 'manageCommunity')::boolean, false)
    ) then
      raise exception 'You need community management access to publish a tool panel';
    end if;
  end if;

  select * into settings_row
  from public.community_tool_settings
  where community_id = p_community_id
    and tool_type = case when p_tool_type = 'rules' then 'verification' else p_tool_type end;
  if not found or not coalesce(settings_row.enabled, false) then
    raise exception 'Save and enable this tool before publishing its panel';
  end if;

  selected_channels := coalesce(settings_row.config -> 'channel_ids', '[]'::jsonb);
  if jsonb_typeof(selected_channels) <> 'array' then
    selected_channels := '[]'::jsonb;
  end if;
  methods := coalesce(settings_row.config -> 'methods', '{}'::jsonb);
  rules_gate := coalesce(settings_row.config -> 'rulesGate', '{}'::jsonb);

  if p_tool_type = 'tickets' then
    if not (
      coalesce(settings_row.channel_id = p_channel_id, false)
      or selected_channels @> jsonb_build_array(p_channel_id::text)
    ) then
      raise exception 'Select this channel in the ticket setup before publishing';
    end if;
  elsif p_tool_type = 'rules' then
    if jsonb_typeof(coalesce(methods -> 'rules' -> 'items', '[]'::jsonb)) <> 'array' then
      raise exception 'Save at least one valid community rule before publishing';
    end if;
    if not coalesce((settings_row.config ->> 'rulesPanelEnabled')::boolean, false)
      or rules_gate ->> 'rulesChannelId' is distinct from p_channel_id::text
      or (
        coalesce((rules_gate ->> 'enabled')::boolean, false)
        and not coalesce((methods -> 'rules' ->> 'enabled')::boolean, false)
      )
      or not exists (
        select 1
        from jsonb_array_elements(coalesce(methods -> 'rules' -> 'items', '[]'::jsonb)) as item(value)
        where nullif(trim(item.value ->> 'title'), '') is not null
      ) then
      raise exception 'Finish and save the rules gate for this channel before publishing';
    end if;
  else
    routed_method := case
      when coalesce((rules_gate ->> 'enabled')::boolean, false)
        and rules_gate ->> 'flow' = 'rules_then_verify'
        and rules_gate ->> 'verificationChannelId' = p_channel_id::text
      then coalesce(rules_gate ->> 'secondMethod', 'quick')
      else null
    end;
    if routed_method is not null then
      if not coalesce((methods -> routed_method ->> 'enabled')::boolean, false) then
        raise exception 'Enable and save the verification check before publishing';
      end if;
    elsif not (
      coalesce(settings_row.channel_id = p_channel_id, false)
      or selected_channels @> jsonb_build_array(p_channel_id::text)
    ) or not exists (
      select 1
      from jsonb_each(coalesce(methods, '{}'::jsonb)) as method(key, value)
      where coalesce((method.value ->> 'enabled')::boolean, false)
        and method.key <> 'rules'
    ) then
      raise exception 'Select this channel and enable a verification check before publishing';
    end if;
  end if;

  insert into public.community_tool_panel_posts (
    community_id, channel_id, tool_type, published_by
  ) values (
    p_community_id, p_channel_id, p_tool_type, auth.uid()
  )
  on conflict (channel_id, tool_type) do update
    set published_by = excluded.published_by,
        updated_at = now()
  returning id into panel_id;

  return panel_id;
end;
$$;

alter function public.publish_community_tool_panel(uuid, uuid, text) owner to postgres;
revoke all on function public.publish_community_tool_panel(uuid, uuid, text) from public;
grant execute on function public.publish_community_tool_panel(uuid, uuid, text) to authenticated;
