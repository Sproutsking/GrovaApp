create or replace function public.join_community_via_invite(
  p_code text,
  p_user_id uuid
)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.community_invites;
  target_community public.communities;
  default_role_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'You can only join as the signed-in user';
  end if;

  select * into invite_row
  from public.community_invites
  where upper(code) = upper(trim(p_code))
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses < max_uses)
  for update;

  if not found then raise exception 'Invite is invalid, expired, or already used'; end if;

  select * into target_community
  from public.communities
  where id = invite_row.community_id and deleted_at is null
  for update;

  if not found then raise exception 'Community not found'; end if;
  if exists (select 1 from public.community_members where community_id = target_community.id and user_id = p_user_id) then
    raise exception 'Already a member';
  end if;

  select id into default_role_id
  from public.community_roles
  where community_id = target_community.id and is_default = true
  order by position asc
  limit 1;

  if default_role_id is null then
    insert into public.community_roles (community_id, name, color, position, permissions, is_default)
    values (target_community.id, 'Novis', '#95A5A6', 2,
      jsonb_build_object('viewChannels', true, 'viewMembers', true, 'readMessageHistory', true, 'sendMessages', false, 'addReactions', false), true)
    returning id into default_role_id;
  end if;

  insert into public.community_members (community_id, user_id, role_id, is_online, last_seen)
  values (target_community.id, p_user_id, default_role_id, true, now());

  update public.community_invites
  set uses = coalesce(uses, 0) + 1
  where id = invite_row.id;

  update public.communities
  set member_count = coalesce(member_count, 0) + 1
  where id = target_community.id;

  select * into target_community from public.communities where id = target_community.id;
  return target_community;
end;
$$;

alter function public.join_community_via_invite(text, uuid) owner to postgres;
revoke all on function public.join_community_via_invite(text, uuid) from public;
grant execute on function public.join_community_via_invite(text, uuid) to authenticated;
