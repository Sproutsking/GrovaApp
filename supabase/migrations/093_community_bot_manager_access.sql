create or replace function public.community_user_can_manage_bots(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.communities c
    where c.id = p_community_id
      and (
        c.owner_id = auth.uid()
        or exists (
          select 1
          from public.community_members m
          join public.community_roles r
            on r.id = m.role_id and r.community_id = m.community_id
          where m.community_id = c.id
            and m.user_id = auth.uid()
            and (
              coalesce((r.permissions ->> 'administrator')::boolean, false)
              or coalesce((r.permissions ->> 'manageCommunity')::boolean, false)
            )
        )
      )
  )
$$;

alter function public.community_user_can_manage_bots(uuid) owner to postgres;
revoke all on function public.community_user_can_manage_bots(uuid) from public;
grant execute on function public.community_user_can_manage_bots(uuid) to authenticated;

drop policy if exists community_bot_integrations_managers on public.community_bot_integrations;
create policy community_bot_integrations_managers on public.community_bot_integrations
  for all
  using (public.community_user_can_manage_bots(community_id))
  with check (public.community_user_can_manage_bots(community_id));

drop policy if exists community_bot_destinations_managers on public.community_bot_destinations;
create policy community_bot_destinations_managers on public.community_bot_destinations
  for all
  using (public.community_user_can_manage_bots(community_id))
  with check (public.community_user_can_manage_bots(community_id));
