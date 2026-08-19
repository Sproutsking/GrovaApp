-- Let authenticated users join public communities without creating roles from
-- the browser. The function owns the default-role fallback and membership
-- counter update so both operations remain authorized and consistent.
create or replace function public.join_public_community(
  p_community_id uuid,
  p_user_id uuid
)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  target_community public.communities;
  default_role_id uuid;
  joined_member public.community_members;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'You can only join as the signed-in user';
  end if;

  select * into target_community
  from public.communities
  where id = p_community_id and deleted_at is null
  for update;

  if not found then raise exception 'Community not found'; end if;
  if target_community.is_private then
    raise exception 'Cannot join a private community without an invite';
  end if;

  if exists (
    select 1 from public.community_members
    where community_id = p_community_id and user_id = p_user_id
  ) then
    raise exception 'Already a member';
  end if;

  select id into default_role_id
  from public.community_roles
  where community_id = p_community_id and is_default = true
  order by position asc
  limit 1;

  if default_role_id is null then
    insert into public.community_roles (
      community_id, name, color, position, permissions, is_default
    ) values (
      p_community_id,
      'Novis',
      '#95A5A6',
      2,
      jsonb_build_object(
        'viewChannels', true,
        'viewMembers', true,
        'readMessageHistory', true,
        'sendMessages', false,
        'addReactions', false
      ),
      true
    )
    returning id into default_role_id;
  end if;

  insert into public.community_members (
    community_id, user_id, role_id, is_online, last_seen
  ) values (
    p_community_id, p_user_id, default_role_id, true, now()
  ) returning * into joined_member;

  update public.communities
  set member_count = coalesce(member_count, 0) + 1
  where id = p_community_id;

  select * into target_community from public.communities where id = p_community_id;
  return target_community;
end;
$$;

-- Supabase table RLS must not block the controlled role fallback inside this
-- function. The postgres owner bypasses RLS for SECURITY DEFINER execution.
alter function public.join_public_community(uuid, uuid) owner to postgres;

revoke all on function public.join_public_community(uuid, uuid) from public;
grant execute on function public.join_public_community(uuid, uuid) to authenticated;

insert into storage.buckets (id, name, public)
values ('community-assets', 'community-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Community assets are publicly readable" on storage.objects;
create policy "Community assets are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'community-assets');

drop policy if exists "Authenticated users can upload community assets" on storage.objects;
create policy "Authenticated users can upload community assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'community-assets');