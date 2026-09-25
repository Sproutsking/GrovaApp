-- Security boundary for profile, wallet, and transaction data.
-- Run after the existing admin hardening migrations.

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.ep_transactions enable row level security;
alter table public.transactions enable row level security;
alter table public.wallet_history enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.wallets from anon;
revoke all on table public.ep_transactions from anon;
revoke all on table public.transactions from anon;
revoke all on table public.wallet_history from anon;

grant select on table public.profiles to authenticated;
grant insert, update on table public.profiles to authenticated;
grant select on table public.wallets to authenticated;
grant update on table public.wallets to authenticated;
grant select on table public.ep_transactions to authenticated;
grant select on table public.transactions to authenticated;
grant select on table public.wallet_history to authenticated;

drop policy if exists profiles_authenticated_read on public.profiles;
create policy profiles_authenticated_read on public.profiles
for select to authenticated
using (
  deleted_at is null
  or id = auth.uid()
  or public.current_admin_role() is not null
);

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists profiles_owner_or_admin_update on public.profiles;
create policy profiles_owner_or_admin_update on public.profiles
for update to authenticated
using (id = auth.uid() or public.current_admin_role() is not null)
with check (id = auth.uid() or public.current_admin_role() is not null);

drop policy if exists wallets_owner_or_admin_read on public.wallets;
create policy wallets_owner_or_admin_read on public.wallets
for select to authenticated
using (user_id = auth.uid() or public.current_admin_role() is not null);

drop policy if exists wallets_owner_or_admin_update on public.wallets;
create policy wallets_owner_or_admin_update on public.wallets
for update to authenticated
using (user_id = auth.uid() or public.current_admin_role() is not null)
with check (user_id = auth.uid() or public.current_admin_role() is not null);

drop policy if exists ep_transactions_owner_or_admin_read on public.ep_transactions;
create policy ep_transactions_owner_or_admin_read on public.ep_transactions
for select to authenticated
using (user_id = auth.uid() or public.current_admin_role() is not null);

drop policy if exists transactions_owner_or_admin_read on public.transactions;
create policy transactions_owner_or_admin_read on public.transactions
for select to authenticated
using (from_user_id = auth.uid() or to_user_id = auth.uid() or public.current_admin_role() is not null);

drop policy if exists wallet_history_owner_or_admin_read on public.wallet_history;
create policy wallet_history_owner_or_admin_read on public.wallet_history
for select to authenticated
using (user_id = auth.uid() or public.current_admin_role() is not null);

create or replace function public.prevent_client_balance_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and public.current_admin_role() is null
     and (
       new.xev_tokens is distinct from old.xev_tokens
       or new.engagement_points is distinct from old.engagement_points
       or new.paywave_balance is distinct from old.paywave_balance
       or new.usdt_balance is distinct from old.usdt_balance
      or new.daily_withdrawal_limit is distinct from old.daily_withdrawal_limit
     ) then
    raise exception 'Wallet balances are server-authoritative';
  end if;
  return new;
end;
$$;

drop trigger if exists wallet_balance_guard on public.wallets;
create trigger wallet_balance_guard
before update on public.wallets
for each row execute function public.prevent_client_balance_mutation();

revoke all on function public.prevent_client_balance_mutation() from public;
grant execute on function public.prevent_client_balance_mutation() to authenticated;

create or replace function public.prevent_client_profile_privilege_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and public.current_admin_role() is null then
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

drop trigger if exists profile_privilege_guard on public.profiles;
create trigger profile_privilege_guard
before insert or update on public.profiles
for each row execute function public.prevent_client_profile_privilege_mutation();

revoke all on function public.prevent_client_profile_privilege_mutation() from public;
grant execute on function public.prevent_client_profile_privilege_mutation() to authenticated;
