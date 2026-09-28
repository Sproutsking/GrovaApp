create or replace function public.prevent_client_profile_privilege_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null
     and current_user in ('anon', 'authenticated')
     and public.current_admin_role() is null then
    if tg_op = 'INSERT' and (
       coalesce(new.is_admin, false)
       or coalesce(new.is_pro, false)
       or coalesce(new.account_status, 'active') <> 'active'
       or new.deleted_at is not null
       or new.deactivated_reason is not null
       or new.account_locked_until is not null
       or coalesce(new.failed_login_attempts, 0) <> 0
       or coalesce(new.security_level, 1) <> 1
       or coalesce(new.payment_status, 'pending') <> 'pending'
       or new.payment_date is not null
       or new.next_payment_date is not null
       or coalesce(new.account_activated, false)
       or coalesce(new.subscription_tier, 'free') <> 'free'
       or new.subscription_expires is not null
       or new.pro_expires_at is not null
       or new.stripe_customer_id is not null
       or new.paystack_customer_id is not null
       or coalesce(new.engagement_points, 0) <> 0
       or coalesce(new.reward_level, 'none') <> 'none'
       or new.reward_level_since is not null
       or coalesce(new.level_activity_score, 0) <> 0
    ) then
      raise exception 'Protected profile fields must use their defaults';
    end if;

    if tg_op = 'UPDATE' and (
       new.is_admin is distinct from old.is_admin
       or new.is_pro is distinct from old.is_pro
       or new.account_status is distinct from old.account_status
       or new.deleted_at is distinct from old.deleted_at
       or new.deactivated_reason is distinct from old.deactivated_reason
       or new.account_locked_until is distinct from old.account_locked_until
       or new.failed_login_attempts is distinct from old.failed_login_attempts
       or new.security_level is distinct from old.security_level
       or new.payment_status is distinct from old.payment_status
       or new.payment_date is distinct from old.payment_date
       or new.next_payment_date is distinct from old.next_payment_date
       or new.account_activated is distinct from old.account_activated
       or new.subscription_tier is distinct from old.subscription_tier
       or new.subscription_expires is distinct from old.subscription_expires
       or new.pro_expires_at is distinct from old.pro_expires_at
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.paystack_customer_id is distinct from old.paystack_customer_id
       or new.engagement_points is distinct from old.engagement_points
       or new.reward_level is distinct from old.reward_level
       or new.reward_level_since is distinct from old.reward_level_since
       or new.level_activity_score is distinct from old.level_activity_score
    ) then
      raise exception 'Protected profile fields are server-authoritative';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_client_profile_privilege_mutation() from public;
grant execute on function public.prevent_client_profile_privilege_mutation() to authenticated;