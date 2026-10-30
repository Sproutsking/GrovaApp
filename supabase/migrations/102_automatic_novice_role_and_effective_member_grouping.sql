create or replace function public.ensure_default_community_role(p_community_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id uuid;
  default_position integer;
begin
  perform 1
  from public.communities
  where id = p_community_id
  for update;
  if not found then
    raise exception 'Community not found';
  end if;

  select id, position
  into default_role_id, default_position
  from public.community_roles
  where community_id = p_community_id and is_default = true
  order by position asc, created_at asc, id asc
  limit 1
  for update;

  if default_role_id is null then
    select coalesce(max(position), -1) + 1
    into default_position
    from public.community_roles
    where community_id = p_community_id;

    insert into public.community_roles (community_id, name, color, position, permissions, is_default)
    values (
      p_community_id,
      'Novice',
      '#95A5A6',
      default_position,
      jsonb_build_object('viewChannels', true, 'addReactions', true),
      true
    )
    returning id into default_role_id;
  else
    select greatest(
      default_position,
      coalesce(max(position), -1) + 1
    )
    into default_position
    from public.community_roles
    where community_id = p_community_id
      and id <> default_role_id;

    update public.community_roles
    set name = 'Novice',
        position = default_position,
        updated_at = now()
    where id = default_role_id
      and (name is distinct from 'Novice' or position is distinct from default_position);
  end if;

  return default_role_id;
end;
$$;

alter function public.ensure_default_community_role(uuid) owner to postgres;
revoke all on function public.ensure_default_community_role(uuid) from public;

create or replace function public.sync_community_member_default_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id uuid;
begin
  default_role_id := public.ensure_default_community_role(new.community_id);

  if new.role_id is not null then
    insert into public.community_member_roles (community_id, user_id, role_id, assigned_at)
    values (new.community_id, new.user_id, new.role_id, coalesce(new.joined_at, now()))
    on conflict (community_id, user_id, role_id) do nothing;
  end if;

  insert into public.community_member_roles (community_id, user_id, role_id, assigned_at)
  values (new.community_id, new.user_id, default_role_id, coalesce(new.joined_at, now()))
  on conflict (community_id, user_id, role_id) do nothing;

  return new;
end;
$$;

alter function public.sync_community_member_default_role() owner to postgres;

drop trigger if exists community_member_default_role_assignment on public.community_members;
create trigger community_member_default_role_assignment
  after insert on public.community_members
  for each row execute function public.sync_community_member_default_role();

create or replace function public.sync_community_member_effective_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_community_id uuid;
  target_user_id uuid;
begin
  if tg_op = 'DELETE' then
    target_community_id := old.community_id;
    target_user_id := old.user_id;
  else
    target_community_id := new.community_id;
    target_user_id := new.user_id;
  end if;

  update public.community_members
  set role_id = public.get_effective_community_role_id(target_community_id, target_user_id)
  where community_id = target_community_id and user_id = target_user_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

alter function public.sync_community_member_effective_roles() owner to postgres;

do $$
declare
  target_community_id uuid;
  default_role_id uuid;
begin
  for target_community_id in
    select id from public.communities
  loop
    default_role_id := public.ensure_default_community_role(target_community_id);

    insert into public.community_member_roles (community_id, user_id, role_id, assigned_at)
    select member.community_id, member.user_id, default_role_id, coalesce(member.joined_at, now())
    from public.community_members member
    where member.community_id = target_community_id
    on conflict (community_id, user_id, role_id) do nothing;
  end loop;
end;
$$;
