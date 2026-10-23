create or replace function public.transfer_community_ownership(
  p_community_id uuid,
  p_new_owner_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner_id uuid;
  owner_role_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select c.owner_id into current_owner_id
  from public.communities c
  where c.id = p_community_id
  for update;
  if not found then
    raise exception 'Community not found';
  end if;
  if current_owner_id is null or current_owner_id <> auth.uid() then
    raise exception 'Only the current community owner can transfer ownership';
  end if;
  if p_new_owner_id is null or p_new_owner_id = current_owner_id then
    raise exception 'Choose another community member as the new owner';
  end if;
  if not exists (
    select 1 from public.community_members m
    where m.community_id = p_community_id and m.user_id = p_new_owner_id
  ) then
    raise exception 'The new owner must already be a community member';
  end if;

  select r.id into owner_role_id
  from public.community_roles r
  where r.community_id = p_community_id and lower(trim(r.name)) = 'owner'
  order by r.position asc, r.created_at asc
  limit 1
  for update;
  if owner_role_id is null then
    raise exception 'Owner role is missing; repair community owner state before transferring ownership';
  end if;

  insert into public.community_member_roles (community_id, user_id, role_id, assigned_by)
  values (p_community_id, p_new_owner_id, owner_role_id, current_owner_id)
  on conflict (community_id, user_id, role_id) do nothing;

  update public.communities
  set owner_id = p_new_owner_id
  where id = p_community_id;

  delete from public.community_member_roles
  where community_id = p_community_id
    and user_id = current_owner_id
    and role_id = owner_role_id;

  update public.community_members m
  set role_id = public.get_effective_community_role_id(m.community_id, m.user_id)
  where m.community_id = p_community_id
    and m.user_id in (current_owner_id, p_new_owner_id);

  return jsonb_build_object(
    'success', true,
    'community_id', p_community_id,
    'previous_owner_id', current_owner_id,
    'new_owner_id', p_new_owner_id
  );
end;
$$;

alter function public.transfer_community_ownership(uuid, uuid) owner to postgres;
revoke all on function public.transfer_community_ownership(uuid, uuid) from public;
grant execute on function public.transfer_community_ownership(uuid, uuid) to authenticated;
