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
  effective_role_id uuid;
  role_permissions jsonb;
  override_state text;
  target_category_id uuid;
  is_community_owner boolean;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  if p_action is null or p_action not in ('add', 'remove') or nullif(trim(p_emoji), '') is null then
    raise exception 'Invalid reaction';
  end if;
  select * into message_row from public.community_messages where id = p_message_id for update;
  if not found or message_row.deleted_at is not null then raise exception 'Message not found'; end if;
  select ch.category_id into target_category_id
  from public.community_channels ch
  where ch.id = message_row.channel_id;
  if not public.community_user_can_access_channel(
    (select ch.community_id from public.community_channels ch where ch.id = message_row.channel_id),
    p_user_id,
    message_row.channel_id,
    'view'
  ) then raise exception 'You cannot view this channel'; end if;

  effective_role_id := public.get_effective_community_role_id(
    (select ch.community_id from public.community_channels ch where ch.id = message_row.channel_id),
    p_user_id
  );
  select r.permissions into role_permissions
  from public.community_roles r
  where r.id = effective_role_id;
  select exists (
    select 1 from public.communities c
    where c.id = (select ch.community_id from public.community_channels ch where ch.id = message_row.channel_id)
      and c.owner_id = p_user_id
  ) into is_community_owner;
  select cpo.state into override_state
  from public.channel_permission_overrides cpo
  where cpo.channel_id = message_row.channel_id
    and cpo.role_id = effective_role_id
    and cpo.permission = 'addReactions'
  limit 1;
  if override_state is null and target_category_id is not null then
    select cpo.state into override_state
    from public.category_permission_overrides cpo
    where cpo.category_id = target_category_id
      and cpo.role_id = effective_role_id
      and cpo.permission = 'addReactions'
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

alter function public.update_community_message_reaction(uuid, uuid, text, text) owner to postgres;
revoke all on function public.update_community_message_reaction(uuid, uuid, text, text) from public;
grant execute on function public.update_community_message_reaction(uuid, uuid, text, text) to authenticated;