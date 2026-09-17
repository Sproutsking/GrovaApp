-- New members start with only channel visibility and reactions.
-- This repairs communities created by earlier versions of the join flows.
update public.community_roles
set name = 'Novice',
    permissions = jsonb_build_object(
      'viewChannels', true,
      'addReactions', true
    ),
    updated_at = now()
where lower(name) in ('novis', 'novice')
  and is_default = true;

insert into public.community_roles (community_id, name, color, position, permissions, is_default)
select communities.id, 'Novice', '#95A5A6', 2,
       jsonb_build_object('viewChannels', true, 'addReactions', true), true
from public.communities
where not exists (
  select 1 from public.community_roles
  where community_roles.community_id = communities.id
    and community_roles.is_default = true
);

create or replace function public.ensure_default_community_role(p_community_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id uuid;
begin
  select id into default_role_id
  from public.community_roles
  where community_id = p_community_id and is_default = true
  order by position asc
  limit 1;

  if default_role_id is null then
    insert into public.community_roles (community_id, name, color, position, permissions, is_default)
    values (p_community_id, 'Novice', '#95A5A6', 2, jsonb_build_object('viewChannels', true, 'addReactions', true), true)
    returning id into default_role_id;
  end if;

  return default_role_id;
end;
$$;
