-- WALLET Project Schema
-- Tables: 43 total (25 with data)

CREATE TABLE IF NOT EXISTS public.admin_revenue_summary (
  total_payments BIGINT,
  total_revenue_usd BIGINT,
  paystack_count BIGINT,
  web3_count BIGINT,
  paystack_usd BIGINT,
  web3_usd BIGINT,
  total_ep_issued BIGINT,
  activated_users BIGINT,
  paid_users BIGINT,
  free_users BIGINT,
  pending_users BIGINT
);

CREATE TABLE IF NOT EXISTS public.admin_team (
  id UUID,
  user_id UUID,
  email VARCHAR(255),
  full_name VARCHAR(255),
  role VARCHAR(255),
  permissions JSONB,
  status VARCHAR(255),
  last_active TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT -- nullable,
  xa_id BIGINT,
  is_online BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.admin_user_stats (
  activated_users BIGINT,
  paid_users BIGINT,
  free_users BIGINT,
  vip_users BIGINT,
  pending_users BIGINT,
  total_active_accounts BIGINT
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID,
  admin_id TEXT -- nullable,
  admin_name TEXT -- nullable,
  admin_role TEXT -- nullable,
  action VARCHAR(255),
  target_type VARCHAR(255),
  target_id UUID,
  details JSONB,
  ip TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.boost_ep_prices (
  tier VARCHAR(255),
  billing VARCHAR(255),
  ep_cost BIGINT,
  ep_bonus_pct BIGINT,
  usd_equiv FLOAT8
);

CREATE TABLE IF NOT EXISTS public.ep_dashboard (
  id UUID,
  user_id UUID,
  total_ep_earned FLOAT8,
  daily_ep FLOAT8,
  weekly_ep FLOAT8,
  monthly_ep FLOAT8,
  annual_ep FLOAT8,
  last_reset_daily TIMESTAMP WITH TIME ZONE,
  last_reset_weekly TIMESTAMP WITH TIME ZONE,
  last_reset_monthly TIMESTAMP WITH TIME ZONE,
  last_reset_annual TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.ep_transactions (
  id UUID,
  user_id UUID,
  amount BIGINT,
  balance_after FLOAT8,
  type VARCHAR(255),
  reason VARCHAR(255),
  ref_payment_id TEXT -- nullable,
  ref_product_id TEXT -- nullable,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.ep_treasury (
  id UUID,
  partition VARCHAR(255),
  balance BIGINT,
  total_received BIGINT,
  total_disbursed BIGINT,
  last_updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.ep_treasury_config (
  id UUID,
  protocol_fee_pct BIGINT,
  operations_pct BIGINT,
  growth_pct BIGINT,
  xev_rewards_pct BIGINT,
  reserve_pct BIGINT,
  updated_by TEXT -- nullable,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.liquidity_config (
  id UUID,
  singleton BOOLEAN,
  ep_per_usd BIGINT,
  platform_fee_pct BIGINT,
  silver_max_usd BIGINT,
  gold_max_usd BIGINT,
  diamond_max_usd BIGINT,
  warning_threshold FLOAT8,
  critical_threshold FLOAT8,
  updated_by TEXT -- nullable,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.p2p_payment_methods (
  id UUID,
  user_id UUID,
  type VARCHAR(255),
  label VARCHAR(255),
  bank_name VARCHAR(255),
  account_name VARCHAR(255),
  account_number VARCHAR(255),
  wallet_address VARCHAR(255),
  network VARCHAR(255),
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.p2p_rate_limits (
  user_id UUID,
  action VARCHAR(255),
  count BIGINT,
  window_start TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.p2p_reputation (
  id UUID,
  user_id UUID,
  total_trades BIGINT,
  completed_trades BIGINT,
  disputed_trades BIGINT,
  trust_score BIGINT,
  volume_xev BIGINT,
  volume_usdt BIGINT,
  avg_release_secs BIGINT,
  is_verified BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id UUID,
  user_id UUID,
  product_id UUID,
  idempotency_key UUID,
  provider VARCHAR(255),
  provider_session VARCHAR(255),
  amount_cents BIGINT,
  currency VARCHAR(255),
  status VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.payment_products (
  id UUID,
  name VARCHAR(255),
  description VARCHAR(255),
  type VARCHAR(255),
  tier VARCHAR(255),
  amount_usd FLOAT8,
  currency VARCHAR(255),
  stripe_price_id TEXT -- nullable,
  paystack_plan_code TEXT -- nullable,
  interval TEXT -- nullable,
  is_active BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID,
  user_id UUID,
  product_id UUID,
  provider VARCHAR(255),
  provider_payment_id VARCHAR(255),
  provider_customer_id TEXT -- nullable,
  provider_session_id TEXT -- nullable,
  subscription_id TEXT -- nullable,
  subscription_status TEXT -- nullable,
  current_period_start TEXT -- nullable,
  current_period_end TEXT -- nullable,
  amount_cents BIGINT,
  currency VARCHAR(255),
  fee_cents BIGINT,
  net_cents BIGINT,
  status VARCHAR(255),
  failure_reason TEXT -- nullable,
  idempotency_key UUID,
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  chain_id TEXT -- nullable,
  contract_address TEXT -- nullable,
  wallet_address TEXT -- nullable,
  block_number TEXT -- nullable,
  block_confirmations BIGINT,
  ip_address TEXT -- nullable,
  user_agent TEXT -- nullable,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  refunded_at TEXT -- nullable
);

CREATE TABLE IF NOT EXISTS public.paywave_fee_config (
  id UUID,
  transaction_type VARCHAR(255),
  fee_percentage FLOAT8,
  min_amount BIGINT,
  max_amount TEXT -- nullable,
  description TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by TEXT -- nullable
);

CREATE TABLE IF NOT EXISTS public.platform_freeze (
  region VARCHAR(255),
  is_frozen BOOLEAN,
  frozen_by UUID,
  frozen_reason TEXT -- nullable,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID,
  key VARCHAR(255),
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.profile_boosts (
  id UUID,
  user_id UUID,
  boost_tier VARCHAR(255),
  billing VARCHAR(255),
  price_usd BIGINT,
  ep_bonus_pct BIGINT,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(255),
  payment_id TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN,
  ep_cost BIGINT,
  next_renewal_at TEXT -- nullable,
  is_system_grant BOOLEAN,
  grant_reason VARCHAR(255),
  active_theme_id VARCHAR(255),
  theme_selections JSONB
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID,
  from_user_id UUID,
  to_user_id UUID,
  amount BIGINT,
  type VARCHAR(255),
  status VARCHAR(255),
  metadata JSONB,
  requires_pin BOOLEAN,
  pin_verified BOOLEAN,
  ip_address TEXT -- nullable,
  device_fingerprint TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE,
  completed_at TEXT -- nullable
);

CREATE TABLE IF NOT EXISTS public.wallet_addresses (
  id UUID,
  user_id UUID,
  chain VARCHAR(255),
  address TIMESTAMP WITH TIME ZONE,
  public_key TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.wallet_history (
  id UUID,
  wallet_id UUID,
  user_id UUID,
  change_type VARCHAR(255),
  amount FLOAT8,
  balance_before FLOAT8,
  balance_after FLOAT8,
  reason VARCHAR(255),
  transaction_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID,
  user_id UUID,
  xev_tokens BIGINT,
  engagement_points FLOAT8,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  daily_withdrawal_limit BIGINT,
  withdrawal_pin_hash TIMESTAMP WITH TIME ZONE,
  pin_attempts BIGINT,
  pin_locked_until TEXT -- nullable,
  paywave_balance FLOAT8,
  pin_length BIGINT,
  recovery_phrase_encrypted TIMESTAMP WITH TIME ZONE,
  recovery_phrase_hash VARCHAR(255),
  recovery_phrase_word_count BIGINT,
  recovery_phrase_generated_at TIMESTAMP WITH TIME ZONE,
  recovery_phrase_acknowledged_at TEXT -- nullable,
  usdt_balance BIGINT
);

CREATE TABLE IF NOT EXISTS public.withdrawal_queue (
  id UUID,
  user_id UUID,
  ep_amount BIGINT,
  processing_tier BIGINT,
  fee_pct FLOAT8,
  fee_amount FLOAT8,
  net_ep FLOAT8,
  priority BIGINT,
  status VARCHAR(255),
  batch_id TEXT -- nullable,
  system_state_at_submit VARCHAR(255),
  destination_type VARCHAR(255),
  destination_info JSONB,
  requested_at TIMESTAMP WITH TIME ZONE,
  estimated_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_msg TEXT -- nullable,
  admin_notes TEXT -- nullable,
  metadata JSONB
);

