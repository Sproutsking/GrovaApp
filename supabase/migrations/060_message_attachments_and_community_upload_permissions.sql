-- Message attachments and authoritative community upload permission checks.

alter table public.messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

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

  select m.role_id into member_role_id
  from public.community_members m
  where m.community_id = target_channel.community_id and m.user_id = p_user_id;
  if not found then raise exception 'You are not a member of this community'; end if;

  if jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) > 0 then
    if exists (select 1 from public.communities c where c.id = target_channel.community_id and c.owner_id = p_user_id) then
      attachment_allowed := true;
    else
      select r.permissions into role_permissions
      from public.community_roles r
      where r.id = member_role_id;
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

revoke all on function public.send_community_message(uuid, uuid, text, uuid, jsonb) from public;
grant execute on function public.send_community_message(uuid, uuid, text, uuid, jsonb) to authenticated;
