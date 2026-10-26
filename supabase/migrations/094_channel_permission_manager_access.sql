create or replace function public.community_user_can_manage_channel_permissions(
  p_community_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_permissions jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then return false; end if;
  if exists (
    select 1 from public.communities c
    where c.id = p_community_id and c.owner_id = p_user_id
  ) then return true; end if;

  select r.permissions into role_permissions
  from public.community_roles r
  where r.community_id = p_community_id
    and r.id = public.get_effective_community_role_id(p_community_id, p_user_id);

  return coalesce((role_permissions ->> 'administrator')::boolean, false)
    or coalesce((role_permissions ->> 'manageChannels')::boolean, false)
    or coalesce((role_permissions ->> 'manageCommunity')::boolean, false);
end;
$$;

revoke all on function public.community_user_can_manage_channel_permissions(uuid, uuid) from public;
grant execute on function public.community_user_can_manage_channel_permissions(uuid, uuid) to authenticated;

drop policy if exists channel_permission_overrides_managers on public.channel_permission_overrides;
create policy channel_permission_overrides_managers on public.channel_permission_overrides
  for all
  using (public.community_user_can_manage_channel_permissions(community_id, auth.uid()))
  with check (public.community_user_can_manage_channel_permissions(community_id, auth.uid()));

drop policy if exists category_permission_overrides_managers on public.category_permission_overrides;
create policy category_permission_overrides_managers on public.category_permission_overrides
  for all
  using (public.community_user_can_manage_channel_permissions(community_id, auth.uid()))
  with check (public.community_user_can_manage_channel_permissions(community_id, auth.uid()));