alter table public.web3_wallet_deposit_challenges
  add column if not exists requested_usd_amount numeric(18, 6)
  not null default 1;

alter table public.web3_wallet_deposit_challenges
  drop constraint if exists web3_wallet_deposit_challenges_requested_amount_check;

alter table public.web3_wallet_deposit_challenges
  add constraint web3_wallet_deposit_challenges_requested_amount_check
  check (
    requested_usd_amount >= 1
    and requested_usd_amount <= 1000000
    and requested_usd_amount = round(requested_usd_amount, 2)
    and requested_usd_amount::text <> 'NaN'
  );
