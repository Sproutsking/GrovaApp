-- Promote a member from Novis to Member after verification.
create or replace function public.verify_community_member(
  p_community_id uuid,
  p_user_id uuid,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  membership public.community_members%rowtype;
  member_role uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;
  if p_method <> 'reaction-role' then
    return jsonb_build_object('success', false, 'error', 'Verification method is not enabled');
  end if;
  select * into membership from public.community_members where community_id = p_community_id and user_id = p_user_id;
  if not found then return jsonb_build_object('success', false, 'error', 'Community membership not found'); end if;
  select id into member_role from public.community_roles where community_id = p_community_id and lower(name) = 'member' limit 1;
  if member_role is null then return jsonb_build_object('success', false, 'error', 'Member role is not configured'); end if;
  update public.community_members set role_id = member_role where id = membership.id;
  return jsonb_build_object('success', true, 'role_id', member_role);
end;
$$;
revoke all on function public.verify_community_member(uuid, uuid, text) from public;
grant execute on function public.verify_community_member(uuid, uuid, text) to authenticated;
