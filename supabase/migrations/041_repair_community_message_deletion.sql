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
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select ch.community_id, cm.user_id
  into target_community, author_id
  from public.community_messages cm
  join public.community_channels ch on ch.id = cm.channel_id
  where cm.id = p_message_id
    and cm.deleted_at is null
  for update of cm;

  if target_community is null then
    return false;
  end if;

  if author_id <> auth.uid()
     and not public.community_user_has_permission(target_community, auth.uid(), 'manageMessages') then
    raise exception 'You do not have permission to delete this message';
  end if;

  update public.community_messages
  set deleted_at = now(), updated_at = now()
  where id = p_message_id
    and deleted_at is null;

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

alter function public.delete_community_message(uuid) owner to postgres;
revoke all on function public.delete_community_message(uuid) from public;
grant execute on function public.delete_community_message(uuid) to authenticated;