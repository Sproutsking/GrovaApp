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

alter function public.community_user_can_view_members(uuid, uuid) owner to postgres;
revoke all on function public.community_user_can_view_members(uuid, uuid) from public;
grant execute on function public.community_user_can_view_members(uuid, uuid) to authenticated;

drop policy if exists community_member_roles_read_members on public.community_member_roles;
create policy community_member_roles_read_members
  on public.community_member_roles for select
  using (
    user_id = auth.uid()
    or public.community_user_can_view_members(community_id, auth.uid())
  );

create or replace function public.get_direct_message_unread_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  summary jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  with my_conversations as (
    select c.id
    from public.conversations c
    where c.user1_id = current_user_id or c.user2_id = current_user_id
  ),
  unread as (
    select count(*)::bigint as unread_count
    from public.messages m
    join my_conversations c on c.id = m.conversation_id
    where m.sender_id <> current_user_id
      and m.read = false
  )
  select jsonb_build_object(
    'unread_count', unread.unread_count,
    'conversation_ids', coalesce(
      (select jsonb_agg(c.id) from my_conversations c),
      '[]'::jsonb
    )
  )
  into summary
  from unread;

  return summary;
end;
$$;

alter function public.get_direct_message_unread_summary() owner to postgres;
revoke all on function public.get_direct_message_unread_summary() from public;
grant execute on function public.get_direct_message_unread_summary() to authenticated;
