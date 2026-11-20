alter table public.ep_treasury_ledger
  add column if not exists source_category text not null default 'other';

update public.ep_treasury_ledger
set source_category = case
  when coalesce(metadata->>'source_category', '') in ('transaction_fee', 'commission', 'deposit_fee', 'withdrawal_fee', 'other')
    then metadata->>'source_category'
  when reason ilike '%commission%' or metadata ? 'commission_rate' then 'commission'
  when reason ilike '%withdrawal%' then 'withdrawal_fee'
  when reason ilike '%deposit%' then 'deposit_fee'
  when tx_type = 'protocol_fee' or reason ilike '%fee%' then 'transaction_fee'
  else 'other'
end;

alter table public.ep_treasury_ledger
  drop constraint if exists ep_treasury_ledger_source_category_check;
alter table public.ep_treasury_ledger
  add constraint ep_treasury_ledger_source_category_check
  check (source_category in ('transaction_fee', 'commission', 'deposit_fee', 'withdrawal_fee', 'other'));

create index if not exists ep_treasury_ledger_source_category_created_idx
  on public.ep_treasury_ledger (source_category, created_at desc);

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
  v_source_category text;
  allocation record;
begin
  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('success', true, 'credited', 0);
  end if;

  v_source_category := coalesce(p_metadata->>'source_category', '');
  if v_source_category not in ('transaction_fee', 'commission', 'deposit_fee', 'withdrawal_fee', 'other') then
    v_source_category := case
      when coalesce(p_reason, '') ilike '%commission%' then 'commission'
      when coalesce(p_reason, '') ilike '%withdrawal%' then 'withdrawal_fee'
      when coalesce(p_reason, '') ilike '%deposit%' then 'deposit_fee'
      when coalesce(p_reason, '') ilike '%fee%' then 'transaction_fee'
      else 'other'
    end;
  end if;

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
      set balance = balance + allocation.allocation_amount,
          total_received = total_received + allocation.allocation_amount,
          last_updated_at = now()
      where partition = allocation.partition_name;

      insert into public.ep_treasury_ledger (
        tx_type, partition, direction, amount, balance_after, ref_user_id, reason, metadata, source_category
      )
      select
        'protocol_fee',
        partition,
        'credit',
        allocation.allocation_amount,
        balance,
        p_ref_user_id,
        coalesce(p_reason, 'platform fee'),
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source_category', v_source_category),
        v_source_category
      from public.ep_treasury
      where partition = allocation.partition_name;
    end if;
  end loop;

  return jsonb_build_object('success', true, 'credited', p_amount, 'source_category', v_source_category);
end;
$$;

create or replace function public.credit_completed_withdrawal_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from new.status
     and coalesce(new.fee_ep, 0) > 0
     and coalesce(new.metadata->>'source', '') = 'wallet_withdrawal'
     and not exists (
       select 1
       from public.ep_treasury_ledger
       where source_category = 'withdrawal_fee'
         and metadata->>'withdrawal_id' = new.id::text
     ) then
    perform public.credit_platform_treasury_fee(
      new.fee_ep,
      'Bank withdrawal processing fee',
      jsonb_build_object('withdrawal_id', new.id, 'source_category', 'withdrawal_fee'),
      new.user_id
    );
  end if;
  return new;
end;
$$;

revoke all on function public.credit_completed_withdrawal_fee() from public, anon, authenticated;
grant execute on function public.credit_completed_withdrawal_fee() to service_role;

drop trigger if exists withdrawal_queue_credit_completed_fee on public.withdrawal_queue;
create trigger withdrawal_queue_credit_completed_fee
after update of status on public.withdrawal_queue
for each row
when (old.status is distinct from new.status and new.status = 'completed')
execute function public.credit_completed_withdrawal_fee();

create or replace function public.get_ep_treasury_category_summary()
returns table (
  source_category text,
  credited_total numeric,
  debited_total numeric,
  entry_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.admin_team
    where user_id = auth.uid()
      and role = 'ceo_owner'
      and status = 'active'
  ) then
    raise exception 'CEO authorization required';
  end if;

  return query
  select
    categories.category,
    coalesce(sum(ledger.amount) filter (where ledger.direction = 'credit'), 0),
    coalesce(sum(ledger.amount) filter (where ledger.direction = 'debit'), 0),
    count(ledger.id)
  from unnest(array['transaction_fee', 'commission', 'deposit_fee', 'withdrawal_fee', 'other']) as categories(category)
  left join public.ep_treasury_ledger ledger on ledger.source_category = categories.category
  group by categories.category
  order by categories.category;
end;
$$;

revoke all on function public.get_ep_treasury_category_summary() from public, anon;
grant execute on function public.get_ep_treasury_category_summary() to authenticated;
