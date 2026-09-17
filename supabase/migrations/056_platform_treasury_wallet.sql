-- Platform treasury wallet: canonical fee collection, partition balances, and CEO sends.
-- All balance mutations happen in SECURITY DEFINER functions; clients never write balances.

create table if not exists public.ep_treasury (
  id uuid primary key default gen_random_uuid(),
  partition text not null unique check (partition in ('operations', 'growth', 'xev_rewards', 'reserve', 'unallocated')),
  balance numeric not null default 0 check (balance >= 0),
  total_received numeric not null default 0,
  total_disbursed numeric not null default 0,
  last_updated_at timestamptz not null default now()
);

create table if not exists public.ep_treasury_config (
  id uuid primary key default gen_random_uuid(),
  protocol_fee_pct numeric not null default 20 check (protocol_fee_pct between 0 and 100),
  operations_pct numeric not null default 30 check (operations_pct >= 0),
  growth_pct numeric not null default 30 check (growth_pct >= 0),
  xev_rewards_pct numeric not null default 30 check (xev_rewards_pct >= 0),
  reserve_pct numeric not null default 10 check (reserve_pct >= 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ep_treasury_config_split_total check (operations_pct + growth_pct + xev_rewards_pct + reserve_pct = 100)
);

create table if not exists public.ep_treasury_ledger (
  id uuid primary key default gen_random_uuid(),
  tx_type text not null,
  partition text not null references public.ep_treasury(partition),
  direction text not null check (direction in ('credit', 'debit')),
  amount numeric not null check (amount > 0),
  balance_after numeric not null,
  ref_user_id uuid references public.profiles(id),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ep_treasury_disbursements (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  recipient_id uuid not null references public.profiles(id),
  partition text not null references public.ep_treasury(partition),
  amount numeric not null check (amount > 0),
  purpose text not null,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

insert into public.ep_treasury (partition)
values ('operations'), ('growth'), ('xev_rewards'), ('reserve'), ('unallocated')
on conflict (partition) do nothing;

insert into public.ep_treasury_config (protocol_fee_pct, operations_pct, growth_pct, xev_rewards_pct, reserve_pct)
select 20, 30, 30, 30, 10
where not exists (select 1 from public.ep_treasury_config);

alter table public.ep_treasury enable row level security;
alter table public.ep_treasury_config enable row level security;
alter table public.ep_treasury_ledger enable row level security;
alter table public.ep_treasury_disbursements enable row level security;

drop policy if exists ep_treasury_ceo_read on public.ep_treasury;
create policy ep_treasury_ceo_read on public.ep_treasury for select to authenticated
using (exists (select 1 from public.admin_team where user_id = auth.uid() and role = 'ceo_owner' and status = 'active'));
drop policy if exists ep_treasury_config_ceo_read on public.ep_treasury_config;
create policy ep_treasury_config_ceo_read on public.ep_treasury_config for select to authenticated
using (exists (select 1 from public.admin_team where user_id = auth.uid() and role = 'ceo_owner' and status = 'active'));
drop policy if exists ep_treasury_ledger_ceo_read on public.ep_treasury_ledger;
create policy ep_treasury_ledger_ceo_read on public.ep_treasury_ledger for select to authenticated
using (exists (select 1 from public.admin_team where user_id = auth.uid() and role = 'ceo_owner' and status = 'active'));
drop policy if exists ep_treasury_disbursements_ceo_read on public.ep_treasury_disbursements;
create policy ep_treasury_disbursements_ceo_read on public.ep_treasury_disbursements for select to authenticated
using (exists (select 1 from public.admin_team where user_id = auth.uid() and role = 'ceo_owner' and status = 'active'));

create or replace function public.credit_platform_treasury_fee(
  p_amount numeric,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb,
  p_ref_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_ops numeric;
  v_growth numeric;
  v_xev numeric;
  v_reserve numeric;
  v_unallocated numeric;
  v_total numeric;
  allocation record;
begin
  if coalesce(p_amount, 0) <= 0 then return jsonb_build_object('success', true, 'credited', 0); end if;
  select * into c from public.ep_treasury_config order by created_at limit 1;
  if not found then raise exception 'Treasury configuration is missing'; end if;
  v_total := coalesce(c.operations_pct, 0) + coalesce(c.growth_pct, 0) + coalesce(c.xev_rewards_pct, 0) + coalesce(c.reserve_pct, 0);
  if v_total <> 100 then raise exception 'Treasury allocation must total 100%%'; end if;

  v_ops := round(p_amount * c.operations_pct / 100, 4);
  v_growth := round(p_amount * c.growth_pct / 100, 4);
  v_xev := round(p_amount * c.xev_rewards_pct / 100, 4);
  v_reserve := round(p_amount * c.reserve_pct / 100, 4);
  v_unallocated := p_amount - v_ops - v_growth - v_xev - v_reserve;

  for allocation in
    select * from (values
      ('operations', v_ops), ('growth', v_growth), ('xev_rewards', v_xev),
      ('reserve', v_reserve), ('unallocated', v_unallocated)
    ) as allocations(partition_name, allocation_amount)
  loop
    if allocation.allocation_amount > 0 then
      update public.ep_treasury
      set balance = balance + allocation.allocation_amount, total_received = total_received + allocation.allocation_amount, last_updated_at = now()
      where partition = allocation.partition_name;
      insert into public.ep_treasury_ledger(tx_type, partition, direction, amount, balance_after, ref_user_id, reason, metadata)
      select 'protocol_fee', partition, 'credit', allocation.allocation_amount, balance, p_ref_user_id, coalesce(p_reason, 'platform fee'), coalesce(p_metadata, '{}'::jsonb)
      from public.ep_treasury where partition = allocation.partition_name;
    end if;
  end loop;
  return jsonb_build_object('success', true, 'credited', p_amount);
end;
$$;

create or replace function public.credit_protocol_fee_from_engagement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.protocol_fee > 0 and new.status = 'settled' then
    perform public.credit_platform_treasury_fee(new.protocol_fee, 'Ripple engagement fee', jsonb_build_object('event_id', new.id, 'action_type', new.action_type), new.actor_id);
  end if;
  return new;
end;
$$;

drop trigger if exists engagement_events_credit_treasury on public.engagement_events;
create trigger engagement_events_credit_treasury
after insert on public.engagement_events
for each row execute function public.credit_protocol_fee_from_engagement();

create or replace function public.credit_legacy_engagement_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee numeric;
begin
    if new.type = 'spend' and new.reason like 'Engagement - %'
      and coalesce(new.metadata->>'treasury_fee_credited', 'false') <> 'true' then
    v_fee := round(abs(new.amount) * 0.15, 4);
    if v_fee > 0 then
      perform public.credit_platform_treasury_fee(
        v_fee,
        'Legacy engagement fee',
        coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object('ep_transaction_id', new.id),
        new.user_id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ep_transactions_credit_legacy_engagement_fee on public.ep_transactions;
create trigger ep_transactions_credit_legacy_engagement_fee
after insert on public.ep_transactions
for each row execute function public.credit_legacy_engagement_fee();

create or replace function public.ep_treasury_send_to_user(
  p_recipient_id uuid,
  p_amount numeric,
  p_pin text,
  p_partition text default 'operations',
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin record;
  v_wallet public.wallets%rowtype;
  v_expected text;
  v_attempts integer;
  v_lock_until timestamptz;
  v_balance numeric;
  v_new_balance numeric;
  v_disbursement uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_admin from public.admin_team where user_id = auth.uid() and role = 'ceo_owner' and status = 'active' limit 1;
  if not found then raise exception 'CEO authorization required'; end if;
  if p_recipient_id is null or p_amount is null or p_amount <= 0 then raise exception 'Valid recipient and amount required'; end if;
  if p_partition not in ('operations', 'growth', 'xev_rewards', 'reserve', 'unallocated') then raise exception 'Invalid treasury partition'; end if;
  if nullif(trim(coalesce(p_notes, '')), '') is null then raise exception 'Audit note is required'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,12}$' then raise exception 'Invalid security PIN'; end if;

  select * into v_wallet from public.wallets where user_id = auth.uid() for update;
  if v_wallet.withdrawal_pin_hash is null then raise exception 'Set a transaction PIN before sending'; end if;
  if v_wallet.pin_locked_until is not null and v_wallet.pin_locked_until > now() then raise exception 'PIN temporarily locked'; end if;
  v_expected := encode(extensions.digest(convert_to(p_pin || left(replace(auth.uid()::text, '-', ''), 16), 'UTF8'), 'sha256'::text), 'hex');
  if v_expected <> v_wallet.withdrawal_pin_hash then
    v_attempts := coalesce(v_wallet.pin_attempts, 0) + 1;
    v_lock_until := case when v_attempts >= 5 then now() + interval '15 minutes' else null end;
    update public.wallets set pin_attempts = case when v_attempts >= 5 then 0 else v_attempts end, pin_locked_until = v_lock_until, updated_at = now() where user_id = auth.uid();
    raise exception 'Incorrect security PIN';
  end if;
  update public.wallets set pin_attempts = 0, pin_locked_until = null, updated_at = now() where user_id = auth.uid();

  if not exists (select 1 from public.profiles where id = auth.uid() and require_2fa = true) then
    raise exception 'CEO 2FA must be enabled before sending treasury funds';
  end if;

  perform 1 from public.profiles where id = p_recipient_id and account_status = 'active';
  if not found then raise exception 'Recipient is not active'; end if;
  select balance into v_balance from public.ep_treasury where partition = p_partition for update;
  if coalesce(v_balance, 0) < p_amount then raise exception 'Insufficient treasury balance'; end if;

  insert into public.wallets(user_id, xev_tokens, engagement_points, paywave_balance)
  values (p_recipient_id, 0, 0, 0) on conflict (user_id) do nothing;
  update public.ep_treasury set balance = balance - p_amount, total_disbursed = total_disbursed + p_amount, last_updated_at = now() where partition = p_partition returning balance into v_new_balance;
  update public.wallets set engagement_points = coalesce(engagement_points, 0) + p_amount, updated_at = now() where user_id = p_recipient_id;
  insert into public.ep_treasury_ledger(tx_type, partition, direction, amount, balance_after, ref_user_id, reason, metadata)
  values ('ceo_user_send', p_partition, 'debit', p_amount, v_new_balance, p_recipient_id, 'CEO treasury send', jsonb_build_object('admin_id', auth.uid(), 'notes', coalesce(p_notes, '')));
  insert into public.ep_treasury_disbursements(admin_id, recipient_id, partition, amount, purpose, notes)
  values (auth.uid(), p_recipient_id, p_partition, p_amount, 'user_ep_grant', coalesce(p_notes, '')) returning id into v_disbursement;
  insert into public.ep_transactions(user_id, amount, balance_after, type, reason, metadata)
  select p_recipient_id, p_amount, engagement_points, 'admin_grant', 'CEO treasury send', jsonb_build_object('disbursement_id', v_disbursement, 'partition', p_partition)
  from public.wallets where user_id = p_recipient_id;
  insert into public.security_events(user_id, event_type, severity, metadata)
  values (auth.uid(), 'ceo_treasury_send', 'critical', jsonb_build_object('recipient_id', p_recipient_id, 'amount', p_amount, 'partition', p_partition, 'disbursement_id', v_disbursement));
  return jsonb_build_object('success', true, 'disbursement_id', v_disbursement, 'recipient_id', p_recipient_id, 'amount', p_amount, 'balance_after', v_new_balance);
end;
$$;

revoke all on function public.credit_platform_treasury_fee(numeric, text, jsonb, uuid) from public;
revoke all on function public.ep_treasury_send_to_user(uuid, numeric, text, text, text) from public;
grant execute on function public.credit_platform_treasury_fee(numeric, text, jsonb, uuid) to service_role;
grant execute on function public.ep_treasury_send_to_user(uuid, numeric, text, text, text) to authenticated;
