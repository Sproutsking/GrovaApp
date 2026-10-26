alter table public.community_verification_completions
  drop constraint if exists community_verification_completions_method_check;

alter table public.community_verification_completions
  add constraint community_verification_completions_method_check
  check (method in ('rules', 'quick', 'picture', 'reaction'));

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
    #- '{methods,reaction,correctId}'
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

create or replace function public.complete_community_reaction_verification(
  p_community_id uuid,
  p_answer text default null,
  p_role_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_row public.community_tool_settings;
  method_config jsonb;
  role_grant jsonb;
  allowed_role_ids jsonb;
  selected_role_id uuid;
  target_role public.community_roles;
  effective_role_id uuid;
  community_owner_id uuid;
  expected_answer text;
  completion_status text;
  completion_exists boolean := false;
  pending_completion boolean := false;
  rules_gate jsonb;
  rules_flow text;
  default_role_position integer;
  rules_accepted boolean := false;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;
  if not exists (
    select 1 from public.community_members
    where community_id = p_community_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('success', false, 'error', 'Community membership not found');
  end if;

  select * into settings_row
  from public.community_tool_settings
  where community_id = p_community_id and tool_type = 'verification';
  if not found or not coalesce(settings_row.enabled, false) then
    return jsonb_build_object('success', false, 'error', 'Verification is not enabled for this community');
  end if;

  method_config := settings_row.config -> 'methods' -> 'reaction';
  if not coalesce((method_config ->> 'enabled')::boolean, false) then
    return jsonb_build_object('success', false, 'error', 'Reaction verification is disabled');
  end if;
  if jsonb_typeof(method_config -> 'choices') <> 'array' then
    return jsonb_build_object('success', false, 'error', 'Reaction verification choices are not configured correctly');
  end if;
  if jsonb_array_length(method_config -> 'choices') < 1
    or jsonb_array_length(method_config -> 'choices') > 5 then
    return jsonb_build_object('success', false, 'error', 'Reaction verification choices are not configured correctly');
  end if;
  expected_answer := upper(trim(coalesce(method_config ->> 'correctId', '')));
  if expected_answer = '' or not exists (
    select 1
    from jsonb_array_elements(method_config -> 'choices') as choice(value)
    where upper(trim(coalesce(value ->> 'id', ''))) = expected_answer
  ) then
    return jsonb_build_object('success', false, 'error', 'Reaction verification answer is not configured correctly');
  end if;

  rules_gate := coalesce(settings_row.config -> 'rulesGate', '{}'::jsonb);
  rules_flow := coalesce(rules_gate ->> 'flow', 'rules_only');
  if coalesce((rules_gate ->> 'enabled')::boolean, false) then
    if rules_flow not in ('rules_only', 'rules_then_verify')
      or nullif(rules_gate ->> 'rulesChannelId', '') is null then
      return jsonb_build_object('success', false, 'error', 'The community rules gate is not configured correctly');
    end if;
    if rules_flow = 'rules_only' then
      return jsonb_build_object('success', false, 'error', 'Complete the rules gate before requesting access');
    end if;
    if nullif(rules_gate ->> 'verificationChannelId', '') is null
      or rules_gate ->> 'verificationChannelId' = rules_gate ->> 'rulesChannelId'
      or coalesce(rules_gate ->> 'secondMethod', '') not in ('quick', 'picture', 'reaction') then
      return jsonb_build_object('success', false, 'error', 'The second verification step is not configured correctly');
    end if;
    if rules_gate ->> 'secondMethod' <> 'reaction' then
      return jsonb_build_object('success', false, 'error', 'This is not the verification step configured for this community');
    end if;
    select exists (
      select 1 from public.community_verification_completions
      where community_id = p_community_id and user_id = auth.uid()
        and method = 'rules' and status in ('rules_accepted', 'completed')
    ) into rules_accepted;
    if not rules_accepted then
      return jsonb_build_object('success', false, 'error', 'Accept the community rules before continuing');
    end if;
  end if;

  select status into completion_status
  from public.community_verification_completions
  where community_id = p_community_id and user_id = auth.uid() and method = 'reaction';
  completion_exists := found;
  if completion_exists and completion_status = 'completed' then
    return jsonb_build_object('success', true, 'already_completed', true, 'method', 'reaction');
  end if;
  pending_completion := completion_exists and completion_status = 'role_selection_pending';

  if not pending_completion then
    if upper(trim(coalesce(p_answer, ''))) <> expected_answer then
      return jsonb_build_object('success', false, 'error', 'That answer is not correct. Try again.');
    end if;
  end if;

  select owner_id into community_owner_id from public.communities where id = p_community_id;
  if community_owner_id = auth.uid() then
    return jsonb_build_object('success', true, 'preserved_role', true, 'message', 'Community owner role preserved');
  end if;

  role_grant := coalesce(settings_row.config -> 'roleGrant', '{}'::jsonb);
  allowed_role_ids := coalesce(role_grant -> 'roleIds', '[]'::jsonb);
  if not coalesce((role_grant ->> 'enabled')::boolean, false) then
    allowed_role_ids := '[]'::jsonb;
  end if;
  if jsonb_typeof(allowed_role_ids) <> 'array' then allowed_role_ids := '[]'::jsonb; end if;
  if jsonb_array_length(allowed_role_ids) = 0 then
    if nullif(method_config ->> 'roleId', '') is not null then
      allowed_role_ids := jsonb_build_array(method_config ->> 'roleId');
    elsif nullif(role_grant ->> 'roleId', '') is not null then
      allowed_role_ids := jsonb_build_array(role_grant ->> 'roleId');
    else
      select id into selected_role_id
      from public.community_roles
      where community_id = p_community_id and lower(trim(name)) = 'member'
      order by position asc limit 1;
      if selected_role_id is not null then allowed_role_ids := jsonb_build_array(selected_role_id::text); end if;
    end if;
  end if;
  select position into default_role_position
  from public.community_roles
  where community_id = p_community_id and is_default = true
  order by position asc limit 1;
  select coalesce(jsonb_agg(r.id::text order by r.position), '[]'::jsonb)
  into allowed_role_ids
  from public.community_roles r
  where r.community_id = p_community_id
    and allowed_role_ids @> jsonb_build_array(r.id::text)
    and not r.is_default
    and lower(trim(r.name)) <> 'owner'
    and not coalesce((r.permissions ->> 'administrator')::boolean, false)
    and not coalesce((r.permissions ->> 'manageRoles')::boolean, false)
    and not coalesce((r.permissions ->> 'assignRoles')::boolean, false)
    and not coalesce((r.permissions ->> 'manageCommunity')::boolean, false)
    and not coalesce((r.permissions ->> 'manageChannels')::boolean, false)
    and not coalesce((r.permissions ->> 'kickMembers')::boolean, false)
    and not coalesce((r.permissions ->> 'banMembers')::boolean, false)
    and not coalesce((r.permissions ->> 'manageMessages')::boolean, false)
    and not coalesce((r.permissions ->> 'timeoutMembers')::boolean, false)
    and (default_role_position is null or r.position < default_role_position);
  if jsonb_array_length(allowed_role_ids) = 0 then
    return jsonb_build_object('success', false, 'error', 'The owner has not configured any eligible roles to grant');
  end if;

  selected_role_id := p_role_id;
  if selected_role_id is null and jsonb_array_length(allowed_role_ids) = 1
    and not coalesce((role_grant ->> 'enabled')::boolean, false) then
    select id into selected_role_id
    from public.community_roles
    where community_id = p_community_id
      and id::text = (allowed_role_ids ->> 0)
    limit 1;
  end if;
  if selected_role_id is null and (
    jsonb_array_length(allowed_role_ids) > 1
    or (coalesce((role_grant ->> 'enabled')::boolean, false) and jsonb_array_length(allowed_role_ids) > 0)
  ) then
    insert into public.community_verification_completions (community_id, user_id, method, role_id, status)
    values (p_community_id, auth.uid(), 'reaction', null, 'role_selection_pending')
    on conflict (community_id, user_id, method) do update
      set role_id = null, status = 'role_selection_pending', completed_at = now();
    return jsonb_build_object('success', true, 'needs_role_selection', true, 'method', 'reaction');
  end if;
  if selected_role_id is null or not (allowed_role_ids @> jsonb_build_array(selected_role_id::text)) then
    return jsonb_build_object('success', false, 'error', 'Choose one of the roles configured by the community owner');
  end if;

  select * into target_role from public.community_roles
  where id = selected_role_id and community_id = p_community_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'The selected role is no longer available');
  end if;
  if target_role.is_default or lower(trim(target_role.name)) = 'owner'
    or coalesce((target_role.permissions ->> 'administrator')::boolean, false)
    or coalesce((target_role.permissions ->> 'manageRoles')::boolean, false)
    or coalesce((target_role.permissions ->> 'assignRoles')::boolean, false)
    or coalesce((target_role.permissions ->> 'manageCommunity')::boolean, false)
    or coalesce((target_role.permissions ->> 'manageChannels')::boolean, false)
    or coalesce((target_role.permissions ->> 'kickMembers')::boolean, false)
    or coalesce((target_role.permissions ->> 'banMembers')::boolean, false)
    or coalesce((target_role.permissions ->> 'manageMessages')::boolean, false)
    or coalesce((target_role.permissions ->> 'timeoutMembers')::boolean, false) then
    return jsonb_build_object('success', false, 'error', 'This role cannot be granted through verification');
  end if;
  if default_role_position is not null and target_role.position >= default_role_position then
    return jsonb_build_object('success', false, 'error', 'Place selectable verification roles above the default member role in the role hierarchy');
  end if;

  insert into public.community_member_roles (community_id, user_id, role_id, assigned_by)
  values (p_community_id, auth.uid(), selected_role_id, null)
  on conflict (community_id, user_id, role_id) do nothing;
  effective_role_id := public.get_effective_community_role_id(p_community_id, auth.uid());
  update public.community_members set role_id = effective_role_id
  where community_id = p_community_id and user_id = auth.uid();
  insert into public.community_verification_completions (community_id, user_id, method, role_id, status)
  values (p_community_id, auth.uid(), 'reaction', selected_role_id, 'completed')
  on conflict (community_id, user_id, method) do update
    set role_id = excluded.role_id, status = 'completed', completed_at = now();
  return jsonb_build_object('success', true, 'role_id', selected_role_id, 'effective_role_id', effective_role_id, 'method', 'reaction');
end;
$$;

alter function public.complete_community_reaction_verification(uuid, text, uuid) owner to postgres;
revoke all on function public.complete_community_reaction_verification(uuid, text, uuid) from public;
grant execute on function public.complete_community_reaction_verification(uuid, text, uuid) to authenticated;

alter function public.complete_community_verification(uuid, text, text, boolean, uuid) rename to complete_community_verification_legacy;

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
  settings_row public.community_tool_settings;
  rules_gate jsonb;
  community_owner_id uuid;
begin
  if p_method in ('rules', 'rules_gate') then
    select * into settings_row
    from public.community_tool_settings
    where community_id = p_community_id and tool_type = 'verification';
    rules_gate := coalesce(settings_row.config -> 'rulesGate', '{}'::jsonb);
    if coalesce((rules_gate ->> 'enabled')::boolean, false)
      and rules_gate ->> 'flow' = 'rules_then_verify'
      and rules_gate ->> 'secondMethod' = 'reaction' then
      if auth.uid() is null then
        return jsonb_build_object('success', false, 'error', 'Unauthorized');
      end if;
      if not coalesce(settings_row.enabled, false)
        or not coalesce((settings_row.config -> 'methods' -> 'rules' ->> 'enabled')::boolean, false)
        or nullif(rules_gate ->> 'rulesChannelId', '') is null
        or nullif(rules_gate ->> 'verificationChannelId', '') is null
        or rules_gate ->> 'rulesChannelId' = rules_gate ->> 'verificationChannelId' then
        return jsonb_build_object('success', false, 'error', 'The community rules gate is not configured correctly');
      end if;
      if not exists (
        select 1 from public.community_members
        where community_id = p_community_id and user_id = auth.uid()
      ) then
        return jsonb_build_object('success', false, 'error', 'Community membership not found');
      end if;
      if not coalesce(p_accepted, false) then
        return jsonb_build_object('success', false, 'error', 'You must accept the rules before continuing');
      end if;
      select owner_id into community_owner_id from public.communities where id = p_community_id;
      if community_owner_id = auth.uid() then
        return jsonb_build_object('success', true, 'preserved_role', true, 'message', 'Community owner role preserved');
      end if;
      insert into public.community_verification_completions (community_id, user_id, method, role_id, status)
      values (p_community_id, auth.uid(), 'rules', null, 'rules_accepted')
      on conflict (community_id, user_id, method) do update
        set role_id = null, status = 'rules_accepted', completed_at = now();
      return jsonb_build_object('success', true, 'rules_accepted', true, 'method', 'rules');
    end if;
  end if;

  return public.complete_community_verification_legacy(
    p_community_id, p_method, p_answer, p_accepted, p_role_id
  );
end;
$$;

alter function public.complete_community_verification(uuid, text, text, boolean, uuid) owner to postgres;
revoke all on function public.complete_community_verification_legacy(uuid, text, text, boolean, uuid) from public, anon, authenticated;
revoke all on function public.complete_community_verification(uuid, text, text, boolean, uuid) from public;
grant execute on function public.complete_community_verification(uuid, text, text, boolean, uuid) to authenticated;
