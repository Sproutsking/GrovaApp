-- Wallet schema bundle (apply this in the Wallet Supabase project SQL editor)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Minimal public.profiles definition required for wallet foreign keys
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- Minimal connections table required by wallet foreign keys
CREATE TABLE IF NOT EXISTS public.connections (
  id uuid NOT NULL,
  source text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT connections_pkey PRIMARY KEY (id)
);

-- Minimal xrc_records table required for wallet foreign keys
CREATE TABLE IF NOT EXISTS public.xrc_records (
  record_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT xrc_records_pkey PRIMARY KEY (record_id)
);

-- From schema_wallet_production.sql
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  xev_tokens numeric DEFAULT 0 CHECK (xev_tokens >= 0::numeric),
  engagement_points numeric DEFAULT 0 CHECK (engagement_points >= 0::numeric),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  daily_withdrawal_limit numeric DEFAULT 1000,
  withdrawal_pin_hash text,
  pin_attempts integer DEFAULT 0,
  pin_locked_until timestamp with time zone,
  paywave_balance numeric NOT NULL DEFAULT 0,
  pin_length integer DEFAULT 4,
  recovery_phrase_encrypted text,
  recovery_phrase_hash text,
  recovery_phrase_word_count integer DEFAULT 12,
  recovery_phrase_generated_at timestamp with time zone,
  recovery_phrase_acknowledged_at timestamp with time zone,
  usdt_balance numeric NOT NULL DEFAULT 0 CHECK (usdt_balance >= 0::numeric),
  CONSTRAINT wallets_pkey PRIMARY KEY (id),
  CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wallets_pkey'
      AND conrelid = 'public.wallets'::regclass
  ) THEN
    ALTER TABLE public.wallets
      ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.wallet_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chain text NOT NULL CHECK (chain = ANY (ARRAY['evm'::text, 'cardano'::text, 'solana'::text, 'tron'::text])),
  address text NOT NULL,
  public_key text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wallet_addresses_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.wallet_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL,
  user_id uuid NOT NULL,
  change_type text NOT NULL CHECK (change_type = ANY (ARRAY['credit'::text, 'debit'::text])),
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  balance_before numeric NOT NULL CHECK (balance_before >= 0::numeric),
  balance_after numeric NOT NULL CHECK (balance_after >= 0::numeric),
  reason text NOT NULL,
  transaction_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wallet_history_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_history_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id),
  CONSTRAINT wallet_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_user_id uuid,
  to_user_id uuid,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  type text NOT NULL CHECK (type = ANY (ARRAY['unlock_story'::text, 'tip'::text, 'reward'::text, 'purchase'::text, 'withdrawal'::text, 'transfer'::text, 'deposit'::text, 'refund'::text])),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  requires_pin boolean DEFAULT false,
  pin_verified boolean DEFAULT false,
  ip_address text,
  device_fingerprint text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.profiles(id),
  CONSTRAINT transactions_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.payment_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text DEFAULT 'Unnamed Product',
  description text,
  type text NOT NULL CHECK (type = ANY (ARRAY['one_time'::text, 'subscription'::text])),
  tier text NOT NULL DEFAULT 'standard'::text CHECK (tier = ANY (ARRAY['whitelist'::text, 'standard'::text, 'pro'::text, 'vip'::text])),
  amount_usd numeric NOT NULL CHECK (amount_usd > 0::numeric),
  currency text NOT NULL DEFAULT 'USD'::text,
  stripe_price_id text UNIQUE,
  paystack_plan_code text UNIQUE,
  interval text CHECK ("interval" = ANY (ARRAY['month'::text, 'year'::text, NULL::text])),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_products_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['stripe'::text, 'paystack'::text, 'web3'::text])),
  provider_session text,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD'::text,
  status text NOT NULL DEFAULT 'created'::text CHECK (status = ANY (ARRAY['created'::text, 'redirected'::text, 'completed'::text, 'expired'::text, 'failed'::text])),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '00:30:00'::interval),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_intents_pkey PRIMARY KEY (id),
  CONSTRAINT payment_intents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT payment_intents_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.payment_products(id)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['stripe'::text, 'paystack'::text, 'web3'::text])),
  provider_payment_id text UNIQUE,
  provider_customer_id text,
  provider_session_id text UNIQUE,
  subscription_id text UNIQUE,
  subscription_status text CHECK (subscription_status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text, 'trialing'::text, NULL::text])),
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD'::text,
  fee_cents integer NOT NULL DEFAULT 0,
  net_cents integer GENERATED ALWAYS AS (amount_cents - fee_cents) STORED,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text, 'disputed'::text, 'expired'::text])),
  failure_reason text,
  idempotency_key text NOT NULL UNIQUE,
  webhook_received_at timestamp with time zone,
  chain_id integer,
  contract_address text,
  wallet_address text,
  block_number bigint,
  block_confirmations integer DEFAULT 0,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  refunded_at timestamp with time zone,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT payments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.payment_products(id)
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider = ANY (ARRAY['stripe'::text, 'paystack'::text, 'web3'::text])),
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature text,
  verified boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  payment_id uuid,
  idempotency_key text,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  payment_id uuid,
  provider text NOT NULL,
  provider_sub_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text, 'trialing'::text])),
  current_period_start timestamp with time zone NOT NULL,
  current_period_end timestamp with time zone NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamp with time zone,
  trial_end timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT subscriptions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.payment_products(id),
  CONSTRAINT subscriptions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id)
);

CREATE TABLE IF NOT EXISTS public.ep_dashboard (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_ep_earned numeric DEFAULT 0 CHECK (total_ep_earned >= 0::numeric),
  daily_ep numeric DEFAULT 0 CHECK (daily_ep >= 0::numeric),
  weekly_ep numeric DEFAULT 0 CHECK (weekly_ep >= 0::numeric),
  monthly_ep numeric DEFAULT 0 CHECK (monthly_ep >= 0::numeric),
  annual_ep numeric DEFAULT 0 CHECK (annual_ep >= 0::numeric),
  last_reset_daily timestamp with time zone DEFAULT now(),
  last_reset_weekly timestamp with time zone DEFAULT now(),
  last_reset_monthly timestamp with time zone DEFAULT now(),
  last_reset_annual timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ep_dashboard_pkey PRIMARY KEY (id),
  CONSTRAINT ep_dashboard_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.ep_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['purchase_grant'::text, 'invite_grant'::text, 'bonus_grant'::text, 'spend'::text, 'refund'::text, 'expiry'::text])),
  reason text NOT NULL,
  ref_payment_id uuid,
  ref_product_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ep_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT ep_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT ep_transactions_ref_payment_id_fkey FOREIGN KEY (ref_payment_id) REFERENCES public.payments(id),
  CONSTRAINT ep_transactions_ref_product_id_fkey FOREIGN KEY (ref_product_id) REFERENCES public.payment_products(id)
);

CREATE TABLE IF NOT EXISTS public.ep_treasury (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partition text NOT NULL UNIQUE CHECK (partition = ANY (ARRAY['operations'::text, 'growth'::text, 'xev_rewards'::text, 'reserve'::text, 'unallocated'::text])),
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0::numeric),
  total_received numeric NOT NULL DEFAULT 0,
  total_disbursed numeric NOT NULL DEFAULT 0,
  last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ep_treasury_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ep_treasury_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  protocol_fee_pct numeric NOT NULL DEFAULT 20 CHECK (protocol_fee_pct >= 0::numeric AND protocol_fee_pct <= 100::numeric),
  operations_pct numeric NOT NULL DEFAULT 30 CHECK (operations_pct >= 0::numeric),
  growth_pct numeric NOT NULL DEFAULT 30 CHECK (growth_pct >= 0::numeric),
  xev_rewards_pct numeric NOT NULL DEFAULT 30 CHECK (xev_rewards_pct >= 0::numeric),
  reserve_pct numeric NOT NULL DEFAULT 10 CHECK (reserve_pct >= 0::numeric),
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ep_treasury_config_pkey PRIMARY KEY (id),
  CONSTRAINT ep_treasury_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.withdrawal_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  target_address text NOT NULL,
  chain text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'confirmed'::text, 'failed'::text, 'cancelled'::text])),
  pin_verified boolean DEFAULT false,
  requires_pin boolean DEFAULT true,
  transaction_hash text,
  block_number bigint,
  fee_amount numeric,
  net_amount numeric,
  failure_reason text,
  admin_notes text,
  attempted_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT withdrawal_queue_pkey PRIMARY KEY (id),
  CONSTRAINT withdrawal_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT withdrawal_queue_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id)
);

CREATE TABLE IF NOT EXISTS public.p2p_payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  method_type text NOT NULL CHECK (method_type = ANY (ARRAY['bank_account'::text, 'mobile_money'::text, 'crypto_wallet'::text, 'card'::text])),
  provider text,
  account_identifier text NOT NULL,
  account_name text,
  is_verified boolean DEFAULT false,
  verified_at timestamp with time zone,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT p2p_payment_methods_pkey PRIMARY KEY (id),
  CONSTRAINT p2p_payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.p2p_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_address text,
  action_type text,
  action text CHECK (action = ANY (ARRAY['transfer'::text, 'withdrawal'::text])),
  action_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT p2p_rate_limits_pkey PRIMARY KEY (id),
  CONSTRAINT p2p_rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.p2p_reputation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_transactions integer DEFAULT 0,
  successful_transactions integer DEFAULT 0,
  failed_transactions integer DEFAULT 0,
  reputation_score numeric DEFAULT 0,
  avg_release_secs integer DEFAULT 0,
  is_flagged boolean DEFAULT false,
  flag_reason text,
  flagged_at timestamp with time zone,
  last_transaction_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT p2p_reputation_pkey PRIMARY KEY (id),
  CONSTRAINT p2p_reputation_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.paywave_fee_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fee_type text NOT NULL UNIQUE CHECK (fee_type = ANY (ARRAY['platform_fee'::text, 'withdrawal_fee'::text, 'transfer_fee'::text, 'conversion_fee'::text])),
  percentage numeric DEFAULT 0,
  fee_percentage numeric DEFAULT 0,
  fixed_amount numeric DEFAULT 0,
  min_amount numeric DEFAULT 0,
  max_amount numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT paywave_fee_config_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT platform_settings_pkey PRIMARY KEY (id),
  CONSTRAINT platform_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.platform_freeze (
  region text NOT NULL,
  is_frozen boolean DEFAULT false,
  frozen_by uuid,
  frozen_reason text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT platform_freeze_pkey PRIMARY KEY (region),
  CONSTRAINT platform_freeze_frozen_by_fkey FOREIGN KEY (frozen_by) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.liquidity_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chain text NOT NULL UNIQUE,
  min_liquidity numeric NOT NULL,
  target_liquidity numeric NOT NULL,
  current_liquidity numeric NOT NULL DEFAULT 0,
  critical_threshold numeric DEFAULT 0,
  is_enabled boolean DEFAULT true,
  last_rebalanced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT liquidity_config_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.boost_ep_prices (
  tier text NOT NULL,
  billing text NOT NULL,
  ep_cost integer NOT NULL,
  ep_bonus_pct integer NOT NULL DEFAULT 0,
  usd_equiv numeric NOT NULL DEFAULT 0,
  CONSTRAINT boost_ep_prices_pkey PRIMARY KEY (tier, billing)
);

CREATE TABLE IF NOT EXISTS public.admin_revenue_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_revenue numeric NOT NULL DEFAULT 0,
  stripe_revenue numeric NOT NULL DEFAULT 0,
  paystack_revenue numeric NOT NULL DEFAULT 0,
  web3_revenue numeric NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  user_count integer NOT NULL DEFAULT 0,
  activated_users integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_revenue_summary_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.admin_team (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['ceo_owner'::text, 'a_admin'::text, 'b_admin'::text, 'super_admin'::text, 'admin'::text, 'support'::text])),
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  last_active timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  xa_id integer,
  is_online boolean DEFAULT false,
  CONSTRAINT admin_team_pkey PRIMARY KEY (id),
  CONSTRAINT admin_team_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT admin_team_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.admin_user_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  total_users integer DEFAULT 0,
  active_users_today integer DEFAULT 0,
  active_users_week integer DEFAULT 0,
  total_transactions integer DEFAULT 0,
  total_volume_usd numeric DEFAULT 0,
  activated_users integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_user_stats_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid,
  admin_name text,
  admin_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
);

-- From schema_wallet_v2.sql
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
  payment_id TEXT, -- nullable
  created_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN,
  ep_cost BIGINT,
  next_renewal_at TEXT, -- nullable
  is_system_grant BOOLEAN,
  grant_reason VARCHAR(255),
  active_theme_id VARCHAR(255),
  theme_selections JSONB,
  CONSTRAINT profile_boosts_pkey PRIMARY KEY (id)
);

-- Generated from schema_definitions.json for audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for bill_payments
CREATE TABLE IF NOT EXISTS public.bill_payments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  bill_type text NOT NULL,
  provider text,
  recipient text,
  amount numeric NOT NULL,
  status text DEFAULT 'success' NOT NULL,
  meta jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for deep_links
CREATE TABLE IF NOT EXISTS public.deep_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  connection_id uuid,
  platform text,
  instructions jsonb,
  link_url text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (connection_id) REFERENCES public.connections(id)
);

-- Generated from schema_definitions.json for distribution_deep_links
CREATE TABLE IF NOT EXISTS public.distribution_deep_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  post_id uuid NOT NULL,
  platform text NOT NULL,
  deep_link_url text,
  instructions jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- Generated from schema_definitions.json for ep_action_rate_limits
CREATE TABLE IF NOT EXISTS public.ep_action_rate_limits (
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  window_start timestamptz DEFAULT now() NOT NULL,
  action_count int DEFAULT 1 NOT NULL,
  PRIMARY KEY (user_id, action_type),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for ep_treasury_disbursements
CREATE TABLE IF NOT EXISTS public.ep_treasury_disbursements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  partition text NOT NULL,
  purpose text NOT NULL,
  amount numeric NOT NULL,
  recipient_info jsonb NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  requested_by uuid NOT NULL,
  approved_by uuid,
  executed_at timestamptz,
  notes text,
  metadata jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (requested_by) REFERENCES public.profiles(id),
  FOREIGN KEY (approved_by) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for ep_treasury_ledger
CREATE TABLE IF NOT EXISTS public.ep_treasury_ledger (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tx_type text NOT NULL,
  partition text NOT NULL,
  direction text NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  ref_user_id uuid,
  ref_tx_id uuid,
  reason text NOT NULL,
  metadata jsonb NOT NULL,
  authorized_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (ref_user_id) REFERENCES public.profiles(id),
  FOREIGN KEY (authorized_by) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for gift_cards
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  tier text NOT NULL,
  value_ep int NOT NULL,
  price_usd numeric NOT NULL,
  fee_ep int DEFAULT 0 NOT NULL,
  net_ep int NOT NULL,
  sender_id uuid,
  recipient_id uuid,
  occasion text,
  message text,
  status text DEFAULT 'unused' NOT NULL,
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,
  PRIMARY KEY (id),
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id),
  FOREIGN KEY (recipient_id) REFERENCES public.profiles(id),
  FOREIGN KEY (redeemed_by) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for p2p_audit_log
CREATE TABLE IF NOT EXISTS public.p2p_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trade_id uuid,
  offer_id uuid,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  old_status text,
  new_status text,
  details jsonb NOT NULL,
  ip_address text,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for p2p_offers
CREATE TABLE IF NOT EXISTS public.p2p_offers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  seller_id uuid NOT NULL,
  asset text NOT NULL,
  total_amount numeric NOT NULL,
  available_amount numeric NOT NULL,
  price_per_unit numeric NOT NULL,
  currency text DEFAULT 'NGN' NOT NULL,
  payment_method_ids text NOT NULL,
  min_order numeric NOT NULL,
  max_order numeric NOT NULL,
  terms text,
  status text DEFAULT 'active' NOT NULL,
  trades_count int DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (seller_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for p2p_trades
CREATE TABLE IF NOT EXISTS public.p2p_trades (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  offer_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  asset text NOT NULL,
  amount numeric NOT NULL,
  price_per_unit numeric NOT NULL,
  currency text NOT NULL,
  total_fiat numeric NOT NULL,
  payment_method jsonb NOT NULL,
  status text DEFAULT 'CREATED' NOT NULL,
  escrow_tx_id uuid,
  expires_at timestamptz DEFAULT (now() + INTERVAL '00:30:00') NOT NULL,
  buyer_confirmed boolean DEFAULT false NOT NULL,
  seller_confirmed boolean DEFAULT false NOT NULL,
  dispute_opened_by uuid,
  dispute_reason text,
  dispute_evidence jsonb NOT NULL,
  moderator_id uuid,
  resolution_notes text,
  idempotency_key text,
  metadata jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (id),
  FOREIGN KEY (offer_id) REFERENCES public.p2p_offers(id),
  FOREIGN KEY (buyer_id) REFERENCES public.profiles(id),
  FOREIGN KEY (seller_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for p2p_trade_messages
CREATE TABLE IF NOT EXISTS public.p2p_trade_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trade_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message text,
  msg_type text DEFAULT 'text' NOT NULL,
  file_url text,
  file_name text,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (trade_id) REFERENCES public.p2p_trades(id),
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for paywave_admin_audit
CREATE TABLE IF NOT EXISTS public.p2p_escrow (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trade_id uuid NOT NULL,
  holder_id uuid NOT NULL,
  asset text NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'locked' NOT NULL,
  locked_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz,
  PRIMARY KEY (id),
  FOREIGN KEY (trade_id) REFERENCES public.p2p_trades(id),
  FOREIGN KEY (holder_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for p2p_notifications
CREATE TABLE IF NOT EXISTS public.p2p_notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  trade_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  FOREIGN KEY (trade_id) REFERENCES public.p2p_trades(id)
);

-- Generated from schema_definitions.json for paywave_admin_audit
CREATE TABLE IF NOT EXISTS public.paywave_admin_audit (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for paywave_transactions
CREATE TABLE IF NOT EXISTS public.paywave_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  transaction_type text NOT NULL,
  amount numeric NOT NULL,
  fee_amount numeric DEFAULT 0 NOT NULL,
  net_amount numeric DEFAULT 0 NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  provider text,
  recipient_phone text,
  recipient_name text,
  recipient_account text,
  provider_transaction_id text,
  reference_id text,
  metadata jsonb,
  xrc_record_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  FOREIGN KEY (xrc_record_id) REFERENCES public.xrc_records(record_id)
);

-- Generated from schema_definitions.json for platform_liquidity
CREATE TABLE IF NOT EXISTS public.platform_liquidity (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  snapshot_at timestamptz DEFAULT now() NOT NULL,
  total_deposits_usd numeric DEFAULT 0 NOT NULL,
  total_withdrawals_usd numeric DEFAULT 0 NOT NULL,
  available_liquidity_ep numeric DEFAULT 0 NOT NULL,
  outstanding_ep numeric DEFAULT 0 NOT NULL,
  withdrawal_velocity_24h numeric DEFAULT 0 NOT NULL,
  net_flow_ep numeric DEFAULT 0 NOT NULL,
  engagement_flow_24h numeric DEFAULT 0 NOT NULL,
  liquidity_ratio numeric DEFAULT 1 NOT NULL,
  system_state text DEFAULT 'healthy' NOT NULL,
  queue_length int DEFAULT 0 NOT NULL,
  notes text,
  triggered_by text DEFAULT 'auto',
  created_by uuid,
  PRIMARY KEY (id),
  FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for platform_revenue
CREATE TABLE IF NOT EXISTS public.platform_revenue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  amount numeric NOT NULL,
  user_id uuid,
  source text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for reward_pools
CREATE TABLE IF NOT EXISTS public.reward_pools (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  total_revenue numeric DEFAULT 0 NOT NULL,
  silver_pool numeric DEFAULT 0 NOT NULL,
  gold_pool numeric DEFAULT 0 NOT NULL,
  diamond_pool numeric DEFAULT 0 NOT NULL,
  silver_users int DEFAULT 0 NOT NULL,
  gold_users int DEFAULT 0 NOT NULL,
  diamond_users int DEFAULT 0 NOT NULL,
  silver_share numeric DEFAULT 0 NOT NULL,
  gold_share numeric DEFAULT 0 NOT NULL,
  diamond_share numeric DEFAULT 0 NOT NULL,
  distributed boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

-- Generated from schema_definitions.json for savings_plans
CREATE TABLE IF NOT EXISTS public.savings_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  plan_type text NOT NULL,
  plan_name text NOT NULL,
  goal_name text,
  amount numeric NOT NULL,
  balance numeric DEFAULT 0 NOT NULL,
  rate_pct numeric NOT NULL,
  lock_days int DEFAULT 0,
  matures_at timestamptz,
  is_active boolean DEFAULT true NOT NULL,
  completed boolean DEFAULT false NOT NULL,
  interest_earned numeric DEFAULT 0 NOT NULL,
  last_interest_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for staking_positions
CREATE TABLE IF NOT EXISTS public.staking_positions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  duration_days int NOT NULL,
  rate_pct numeric NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  est_return numeric DEFAULT 0 NOT NULL,
  matures_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  actual_return numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for user_cards
CREATE TABLE IF NOT EXISTS public.user_cards (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  card_type text NOT NULL,
  card_name text NOT NULL,
  last_four text NOT NULL,
  brand text NOT NULL,
  expiry text NOT NULL,
  bank_name text,
  balance numeric DEFAULT 0,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for web3_auto_payment_sessions
CREATE TABLE IF NOT EXISTS public.web3_auto_payment_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  wallet_address text NOT NULL,
  wallet_name text NOT NULL,
  chain_type text NOT NULL,
  chain_name text NOT NULL,
  amount_usd numeric NOT NULL,
  amount_token numeric NOT NULL,
  token_symbol text NOT NULL,
  expected_gas_fee numeric DEFAULT 0,
  status text DEFAULT 'initiated' NOT NULL,
  payment_id uuid,
  tx_hash text,
  error_message text,
  error_code text,
  signature text,
  nonce text NOT NULL,
  expires_at timestamptz DEFAULT (now() + INTERVAL '00:10:00') NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  FOREIGN KEY (payment_id) REFERENCES public.payments(id)
);

-- Generated from schema_definitions.json for web3_pending_confirmations
CREATE TABLE IF NOT EXISTS public.web3_pending_confirmations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  payment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  chain_type text NOT NULL,
  chain_name text NOT NULL,
  tx_hash text NOT NULL,
  current_confirmations int DEFAULT 0,
  required_confirmations int DEFAULT 5 NOT NULL,
  is_finalized boolean DEFAULT false,
  finalized_at timestamptz,
  last_checked_at timestamptz DEFAULT now(),
  retry_count int DEFAULT 0,
  max_retries int DEFAULT 10,
  expires_at timestamptz DEFAULT (now() + INTERVAL '24:00:00') NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (payment_id) REFERENCES public.payments(id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for web3_webhook_events
CREATE TABLE IF NOT EXISTS public.web3_webhook_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  payment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  chain_type text NOT NULL,
  chain_name text NOT NULL,
  tx_hash text NOT NULL,
  event_type text NOT NULL,
  block_number bigint,
  confirmations int DEFAULT 0,
  payload jsonb NOT NULL,
  raw_log text,
  verified boolean DEFAULT false,
  processed boolean DEFAULT false,
  processing_error text,
  signature text,
  received_at timestamptz DEFAULT now() NOT NULL,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (payment_id) REFERENCES public.payments(id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for xrc_paywave_records
CREATE TABLE IF NOT EXISTS public.xrc_paywave_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL,
  xrc_record_id uuid NOT NULL,
  verification_status text DEFAULT 'pending' NOT NULL,
  block_number bigint,
  block_timestamp bigint,
  transaction_hash text,
  proof_data jsonb,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (transaction_id) REFERENCES public.paywave_transactions(id),
  FOREIGN KEY (xrc_record_id) REFERENCES public.xrc_records(record_id)
);
