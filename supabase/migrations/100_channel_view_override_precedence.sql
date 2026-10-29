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
  verification_channel_id uuid;
  matching_rule record;
  has_rules boolean;
  allowed boolean;
  permission_override text;
  member_access record;
  verification_route boolean := false;
  view_override_allowed boolean := false;
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

  select coalesce(settings.config, '{}'::jsonb), settings.channel_id
    into verification_config, verification_channel_id
  from public.community_tool_settings settings
  where settings.community_id = p_community_id
    and settings.tool_type = 'verification'
    and settings.enabled = true;
  if p_action = 'view' and (
    verification_channel_id = p_channel_id
    or coalesce(verification_config -> 'channel_ids', '[]'::jsonb)
      @> jsonb_build_array(p_channel_id::text)
  ) then
    verification_route := true;
  end if;
  if p_action = 'view'
    and not verification_route
    and coalesce((verification_config -> 'rulesGate' ->> 'enabled')::boolean, false) then
    verification_route := target_channel.id::text = (verification_config -> 'rulesGate' ->> 'rulesChannelId');
    if not verification_route
      and (verification_config -> 'rulesGate' ->> 'flow') = 'rules_then_verify'
      and target_channel.id::text = (verification_config -> 'rulesGate' ->> 'verificationChannelId') then
      verification_route := exists (
        select 1 from public.community_verification_completions completion
        where completion.community_id = p_community_id
          and completion.user_id = p_user_id
          and completion.method = 'rules'
          and completion.status in ('rules_accepted', 'completed')
      );
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

  select cpo.state into permission_override
  from public.channel_permission_overrides cpo
  where cpo.community_id = p_community_id and cpo.channel_id = p_channel_id
    and cpo.role_id = effective_role_id and cpo.permission = 'viewChannel'
  limit 1;
  if permission_override = 'deny' then return false; end if;
  view_override_allowed := permission_override = 'allow';
  if p_action = 'view' and view_override_allowed then return true; end if;

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
    if permission_override is null and target_category_id is not null then
      select cpo.state into permission_override
      from public.category_permission_overrides cpo
      where cpo.community_id = p_community_id and cpo.category_id = target_category_id
        and cpo.role_id = effective_role_id and cpo.permission = 'viewChannel'
        and cpo.apply_to_channels = true
      limit 1;
      if permission_override = 'deny' then return false; end if;
      view_override_allowed := permission_override = 'allow';
    end if;
    if p_action = 'view' then
      allowed := view_override_allowed
        or verification_route
        or (coalesce((role_permissions ->> 'viewChannels')::boolean, false)
          and not coalesce(target_channel.is_private, false));
      if not allowed then return false; end if;
      return true;
    end if;

    allowed := view_override_allowed
      or (coalesce((role_permissions ->> 'viewChannels')::boolean, false)
        and not coalesce(target_channel.is_private, false));
    if not allowed then return false; end if;
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
    return coalesce((role_permissions ->> 'sendMessages')::boolean, false);
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

alter function public.community_user_can_access_channel(uuid, uuid, uuid, text) owner to postgres;
revoke all on function public.community_user_can_access_channel(uuid, uuid, uuid, text) from public;
grant execute on function public.community_user_can_access_channel(uuid, uuid, uuid, text) to authenticated;

create or replace function public.community_user_can_open_verification_panel(
  p_community_id uuid,
  p_user_id uuid,
  p_channel_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id = auth.uid()
    and public.community_user_can_access_channel(
      p_community_id,
      p_user_id,
      p_channel_id,
      'view'
    )
    and exists (
      select 1
      from public.community_members m
      join public.community_channels ch
        on ch.community_id = m.community_id
       and ch.id = p_channel_id
       and ch.deleted_at is null
      join public.community_tool_settings settings
        on settings.community_id = m.community_id
       and settings.tool_type = 'verification'
       and settings.enabled = true
      where m.community_id = p_community_id
        and m.user_id = p_user_id
        and (
          settings.channel_id = p_channel_id
          or coalesce(settings.config -> 'channel_ids', '[]'::jsonb)
            @> jsonb_build_array(p_channel_id::text)
          or (
            coalesce((settings.config -> 'rulesGate' ->> 'enabled')::boolean, false)
            and settings.config -> 'rulesGate' ->> 'rulesChannelId' = p_channel_id::text
          )
          or (
            coalesce((settings.config -> 'rulesGate' ->> 'enabled')::boolean, false)
            and settings.config -> 'rulesGate' ->> 'flow' = 'rules_then_verify'
            and settings.config -> 'rulesGate' ->> 'verificationChannelId' = p_channel_id::text
            and exists (
              select 1
              from public.community_verification_completions completion
              where completion.community_id = p_community_id
                and completion.user_id = p_user_id
                and completion.method = 'rules'
                and completion.status in ('rules_accepted', 'completed')
            )
          )
        )
    )
$$;

alter function public.community_user_can_open_verification_panel(uuid, uuid, uuid) owner to postgres;
revoke all on function public.community_user_can_open_verification_panel(uuid, uuid, uuid) from public;
grant execute on function public.community_user_can_open_verification_panel(uuid, uuid, uuid) to authenticated;
