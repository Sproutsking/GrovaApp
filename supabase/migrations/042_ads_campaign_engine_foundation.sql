create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 3 and 120),
  objective text not null check (objective in ('awareness', 'community_growth', 'qualified_action', 'conversion')),
  budget_ep numeric not null check (budget_ep > 0),
  escrow_ep numeric not null default 0 check (escrow_ep >= 0),
  status text not null default 'draft' check (status in ('draft', 'funded', 'active', 'paused', 'completed', 'cancelled')),
  audience_definition jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_campaigns_owner_created_idx
  on public.ad_campaigns(owner_id, created_at desc);

alter table public.ad_campaigns enable row level security;

drop policy if exists ad_campaigns_owner_select on public.ad_campaigns;
create policy ad_campaigns_owner_select on public.ad_campaigns
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists ad_campaigns_owner_update on public.ad_campaigns;
create policy ad_campaigns_owner_update on public.ad_campaigns
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.create_ad_campaign(
  p_name text,
  p_objective text,
  p_budget_ep numeric,
  p_audience_definition jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns public.ad_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_campaign public.ad_campaigns;
  v_balance numeric;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) < 3 then raise exception 'Campaign name must be at least 3 characters'; end if;
  if p_objective not in ('awareness', 'community_growth', 'qualified_action', 'conversion') then raise exception 'Invalid campaign objective'; end if;
  if p_budget_ep is null or p_budget_ep <= 0 or p_budget_ep <> trunc(p_budget_ep) then raise exception 'Budget must be a positive whole number of EP'; end if;
  if p_ends_at is not null and p_starts_at is not null and p_ends_at <= p_starts_at then raise exception 'Campaign end must be after campaign start'; end if;

  insert into public.wallets (user_id, xev_tokens, engagement_points, paywave_balance)
  values (v_owner, 0, 0, 0) on conflict (user_id) do nothing;

  select * into v_wallet from public.wallets where user_id = v_owner for update;
  v_balance := coalesce(v_wallet.engagement_points, 0);
  if v_balance < p_budget_ep then raise exception 'Insufficient EP: % available, % required', v_balance, p_budget_ep; end if;

  update public.wallets
  set engagement_points = v_balance - p_budget_ep, updated_at = now()
  where user_id = v_owner;

  insert into public.ad_campaigns (owner_id, name, objective, budget_ep, escrow_ep, status, audience_definition, starts_at, ends_at)
  values (v_owner, trim(p_name), p_objective, p_budget_ep, p_budget_ep, 'funded', coalesce(p_audience_definition, '{}'::jsonb), p_starts_at, p_ends_at)
  returning * into v_campaign;

  insert into public.ep_transactions (user_id, amount, balance_after, type, reason, metadata)
  values (v_owner, -p_budget_ep, v_balance - p_budget_ep, 'spend', 'Ad campaign escrow', jsonb_build_object('campaign_id', v_campaign.id, 'objective', p_objective));

  return v_campaign;
end;
$$;

revoke all on function public.create_ad_campaign(text, text, numeric, jsonb, timestamptz, timestamptz) from public;
grant execute on function public.create_ad_campaign(text, text, numeric, jsonb, timestamptz, timestamptz) to authenticated;
