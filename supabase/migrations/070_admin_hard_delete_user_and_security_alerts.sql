-- Harden the user-delete flow and provide a server-side decision for whether a
-- deleted user may later sign back in. This is intentionally controlled by
-- the database so the browser cannot bypass it.

create or replace function public.admin_hard_delete_user(
  p_target_user_id uuid,
  p_allow_signin_again boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  caller_role := public.current_admin_role();

  if caller_role is null then
    raise exception 'Unauthorized';
  end if;

  if caller_role not in ('ceo_owner', 'super_admin') then
    raise exception 'Only senior admins can delete accounts';
  end if;

  if p_target_user_id is null then
    raise exception 'User id is required';
  end if;

  delete from public.security_alert_viewers
  where admin_user_id = p_target_user_id;

  delete from public.user_sessions
  where user_id = p_target_user_id;

  delete from public.device_fingerprints
  where user_id = p_target_user_id;

  delete from public.admin_team
  where user_id = p_target_user_id;

  update public.profiles
  set
    deleted_at = now(),
    account_status = 'deactivated',
    account_locked_until = now(),
    deactivated_reason = case
      when p_allow_signin_again then 'Deleted by admin; restore allowed'
      else 'Permanently deleted by admin'
    end,
    updated_at = now()
  where id = p_target_user_id;

  -- Supabase does not expose auth.admin.delete_user to database SQL. The
  -- profile lock above is the server-enforced access boundary: the session
  -- is revoked, the profile is deactivated, and account enforcement blocks
  -- any future sign-in from using the account. Auth-user deletion, when
  -- required for legal data erasure, must run through a service-role edge
  -- function rather than an authenticated database RPC.

  return true;
end;
$$;

revoke all on function public.admin_hard_delete_user(uuid, boolean) from public;
grant execute on function public.admin_hard_delete_user(uuid, boolean) to authenticated;
