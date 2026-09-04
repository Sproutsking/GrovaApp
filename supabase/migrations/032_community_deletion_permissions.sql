-- Centralize community moderation authorization for destructive actions.
create or replace function public.community_user_has_permission(
  p_community_id uuid,
  p_user_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.communities c
    where c.id = p_community_id
      and c.deleted_at is null
      and (
        c.owner_id = p_user_id
        or exists (
          select 1
          from public.community_members m
          join public.community_roles r on r.id = m.role_id
          where m.community_id = c.id
            and m.user_id = p_user_id
            and (
              r.permissions @> '{"administrator": true}'::jsonb
              or r.permissions @> jsonb_build_object(p_permission, true)
            )
        )
      )
  );
$$;

create or replace function public.delete_community(
  p_community_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if auth.uid() is null or not public.community_user_has_permission(p_community_id, auth.uid(), 'manageCommunity') then
    raise exception 'You do not have permission to delete this community';
  end if;

  update public.community_messages cm
  set deleted_at = now(), updated_at = now()
  where cm.channel_id in (
    select ch.id from public.community_channels ch where ch.community_id = p_community_id
  ) and cm.deleted_at is null;

  update public.community_channels
  set deleted_at = now(), updated_at = now()
  where community_id = p_community_id and deleted_at is null;

  update public.communities
  set deleted_at = now(), updated_at = now()
  where id = p_community_id and deleted_at is null;

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.delete_community_channel(
  p_channel_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_community uuid;
  changed integer;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;

  select community_id into target_community
  from public.community_channels
  where id = p_channel_id and deleted_at is null
  for update;

  if target_community is null then return false; end if;
  if not public.community_user_has_permission(target_community, auth.uid(), 'manageChannels') then
    raise exception 'You do not have permission to delete this channel';
  end if;

  update public.community_messages
  set deleted_at = now(), updated_at = now()
  where channel_id = p_channel_id and deleted_at is null;

  update public.community_channels
  set deleted_at = now(), updated_at = now()
  where id = p_channel_id and deleted_at is null;

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.delete_community_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_community uuid;
  author_id uuid;
  changed integer;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;

  select ch.community_id, cm.user_id
  into target_community, author_id
  from public.community_messages cm
  join public.community_channels ch on ch.id = cm.channel_id
  where cm.id = p_message_id and cm.deleted_at is null
  for update;

  if target_community is null then return false; end if;
  if author_id <> auth.uid()
     and not public.community_user_has_permission(target_community, auth.uid(), 'manageMessages') then
    raise exception 'You do not have permission to delete this message';
  end if;

  update public.community_messages
  set deleted_at = now(), updated_at = now()
  where id = p_message_id and deleted_at is null;

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

alter function public.community_user_has_permission(uuid, uuid, text) owner to postgres;
alter function public.delete_community(uuid) owner to postgres;
alter function public.delete_community_channel(uuid) owner to postgres;
alter function public.delete_community_message(uuid) owner to postgres;

revoke all on function public.community_user_has_permission(uuid, uuid, text) from public;
revoke all on function public.delete_community(uuid) from public;
revoke all on function public.delete_community_channel(uuid) from public;
revoke all on function public.delete_community_message(uuid) from public;
grant execute on function public.delete_community(uuid) to authenticated;
grant execute on function public.delete_community_channel(uuid) to authenticated;
grant execute on function public.delete_community_message(uuid) to authenticated;
