create or replace function public.get_community_bot_manageable_communities()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name
  from public.communities c
  where auth.uid() is not null
    and c.deleted_at is null
    and public.community_user_can_manage_bots(c.id)
  order by lower(c.name), c.id
$$;

alter function public.get_community_bot_manageable_communities() owner to postgres;
revoke all on function public.get_community_bot_manageable_communities() from public, anon;
grant execute on function public.get_community_bot_manageable_communities() to authenticated;