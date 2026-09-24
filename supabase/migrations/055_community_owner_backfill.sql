-- Repair historical communities that were created before the protected Owner role
-- and owner membership row were enforced. This keeps ownership durable and visible.
create or replace function public.repair_community_owner_state(p_community_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  community_record record;
  owner_role_id uuid;
begin
  for community_record in
    select c.id, c.owner_id
    from public.communities c
    where (p_community_id is null or c.id = p_community_id)
      and c.owner_id is not null
  loop
    select cr.id
    into owner_role_id
    from public.community_roles cr
    where cr.community_id = community_record.id
      and lower(trim(cr.name)) = 'owner'
    order by cr.position asc, cr.created_at asc
    limit 1;

    if owner_role_id is null then
      insert into public.community_roles (
        community_id, name, color, position, permissions, is_default
      ) values (
        community_record.id,
        'Owner',
        '#FFD700',
        0,
        jsonb_build_object(
          'sendMessages', true,
          'manageChannels', true,
          'manageMessages', true,
          'manageCommunity', true,
          'manageRoles', true,
          'administrator', true,
          'createChannels', true,
          'viewChannels', true,
          'viewMembers', true,
          'inviteMembers', true,
          'banMembers', true,
          'assignRoles', true,
          'manageInvites', true
        ),
        false
      ) returning id into owner_role_id;
    end if;

    insert into public.community_members (community_id, user_id, role_id, is_online, last_seen)
    values (community_record.id, community_record.owner_id, owner_role_id, true, now())
    on conflict (community_id, user_id) do update
      set role_id = excluded.role_id,
          is_online = true,
          last_seen = now();
  end loop;
end;
$$;

alter function public.repair_community_owner_state(uuid) owner to postgres;
revoke all on function public.repair_community_owner_state(uuid) from public;
grant execute on function public.repair_community_owner_state(uuid) to authenticated;

select public.repair_community_owner_state();
