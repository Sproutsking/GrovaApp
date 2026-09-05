-- Allow requesters and community ticket staff to permanently delete closed tickets.
create or replace function public.delete_community_ticket(
  p_channel_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  ticket_row public.community_ticket_channels;
  can_delete boolean;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  select * into ticket_row
  from public.community_ticket_channels
  where channel_id = p_channel_id
  for update;
  if not found then return false; end if;
  if ticket_row.status <> 'closed' then raise exception 'Close the ticket before deleting it'; end if;

  select ticket_row.requester_id = p_user_id or exists (
    select 1
    from public.community_members m
    join public.community_roles r on r.id = m.role_id
    where m.community_id = ticket_row.community_id
      and m.user_id = p_user_id
      and (r.permissions @> '{"administrator": true}'::jsonb
        or r.permissions @> '{"manageCommunity": true}'::jsonb
        or r.permissions @> '{"manageChannels": true}'::jsonb
        or r.permissions @> '{"manageMessages": true}'::jsonb)
  ) into can_delete;
  if not can_delete then raise exception 'You cannot delete this ticket'; end if;

  delete from public.community_member_channel_access where channel_id = p_channel_id;
  delete from public.community_channels where id = p_channel_id;
  delete from public.community_ticket_channels where channel_id = p_channel_id;
  return true;
end;
$$;

alter function public.delete_community_ticket(uuid, uuid) owner to postgres;
revoke all on function public.delete_community_ticket(uuid, uuid) from public;
grant execute on function public.delete_community_ticket(uuid, uuid) to authenticated;