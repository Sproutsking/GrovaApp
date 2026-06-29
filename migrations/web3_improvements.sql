-- ════════════════════════════════════════════════════════════════════════════
-- WEB3 PAYMENT IMPROVEMENTS — Phase 1A Production Hardening
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: Add tables for webhook tracking, idempotency, and confirmation status
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Web3 Webhook Events Tracking ──────────────────────────────────────────
-- Tracks on-chain events from blockchain listeners (RPC, webhooks, etc.)
CREATE TABLE IF NOT EXISTS public.web3_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  chain_type text NOT NULL CHECK (chain_type = ANY (ARRAY['EVM'::text, 'SOLANA'::text, 'CARDANO'::text, 'TRON'::text])),
  chain_name text NOT NULL,
  tx_hash text NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['submitted'::text, 'confirmed'::text, 'failed'::text, 'reverted'::text])),
  block_number bigint,
  confirmations integer DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_log text,
  verified boolean DEFAULT false,
  processed boolean DEFAULT false,
  processing_error text,
  signature text,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT web3_webhook_events_pkey PRIMARY KEY (id),
  CONSTRAINT web3_webhook_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id),
  CONSTRAINT web3_webhook_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_web3_webhook_events_payment_id ON public.web3_webhook_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_web3_webhook_events_tx_hash ON public.web3_webhook_events(tx_hash);
CREATE INDEX IF NOT EXISTS idx_web3_webhook_events_chain_type ON public.web3_webhook_events(chain_type);
CREATE INDEX IF NOT EXISTS idx_web3_webhook_events_processed ON public.web3_webhook_events(processed, processed_at);

-- ── 2. Web3 Pending Confirmations Tracker ────────────────────────────────────
-- Tracks which transactions are waiting for enough block confirmations
CREATE TABLE IF NOT EXISTS public.web3_pending_confirmations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  chain_type text NOT NULL CHECK (chain_type = ANY (ARRAY['EVM'::text, 'SOLANA'::text, 'CARDANO'::text, 'TRON'::text])),
  chain_name text NOT NULL,
  tx_hash text NOT NULL UNIQUE,
  current_confirmations integer DEFAULT 0,
  required_confirmations integer NOT NULL DEFAULT 5,
  is_finalized boolean DEFAULT false,
  finalized_at timestamp with time zone,
  last_checked_at timestamp with time zone DEFAULT now(),
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 10,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '24 hours'::interval),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT web3_pending_confirmations_pkey PRIMARY KEY (id),
  CONSTRAINT web3_pending_confirmations_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id),
  CONSTRAINT web3_pending_confirmations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_web3_pending_confirmations_payment_id ON public.web3_pending_confirmations(payment_id);
CREATE INDEX IF NOT EXISTS idx_web3_pending_confirmations_tx_hash ON public.web3_pending_confirmations(tx_hash);
CREATE INDEX IF NOT EXISTS idx_web3_pending_confirmations_is_finalized ON public.web3_pending_confirmations(is_finalized, expires_at);

-- ── 3. Web3 Auto Payment Sessions ────────────────────────────────────────────
-- Tracks automatic wallet payment flows (WalletConnect, direct signing, etc.)
CREATE TABLE IF NOT EXISTS public.web3_auto_payment_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_address text NOT NULL,
  wallet_name text NOT NULL,
  chain_type text NOT NULL CHECK (chain_type = ANY (ARRAY['EVM'::text, 'SOLANA'::text, 'CARDANO'::text, 'TRON'::text])),
  chain_name text NOT NULL,
  amount_usd numeric NOT NULL CHECK (amount_usd > 0::numeric),
  amount_token numeric NOT NULL,
  token_symbol text NOT NULL,
  expected_gas_fee numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'initiated'::text CHECK (status = ANY (ARRAY['initiated'::text, 'awaiting_signature'::text, 'signed'::text, 'submitted'::text, 'confirmed'::text, 'failed'::text, 'expired'::text])),
  payment_id uuid,
  tx_hash text,
  error_message text,
  error_code text,
  signature text,
  nonce text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '10 minutes'::interval),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT web3_auto_payment_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT web3_auto_payment_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT web3_auto_payment_sessions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id)
);

CREATE INDEX IF NOT EXISTS idx_web3_auto_payment_sessions_user_id ON public.web3_auto_payment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_web3_auto_payment_sessions_nonce ON public.web3_auto_payment_sessions(nonce);
CREATE INDEX IF NOT EXISTS idx_web3_auto_payment_sessions_status ON public.web3_auto_payment_sessions(status, expires_at);

-- ── 4. Enhance payments table with Web3 fields (if not already present) ───────
-- Verify key Web3 fields exist
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS chain_id integer,
ADD COLUMN IF NOT EXISTS contract_address text,
ADD COLUMN IF NOT EXISTS wallet_address text,
ADD COLUMN IF NOT EXISTS block_number bigint,
ADD COLUMN IF NOT EXISTS block_confirmations integer DEFAULT 0;

-- ── 5. Indexes for fast payment lookups ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_user_id_status ON public.payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON public.payments(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key ON public.payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_wallet_address ON public.payments(wallet_address);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- ── 6. Function: Get pending Web3 confirmations for a payment ──────────────────
CREATE OR REPLACE FUNCTION public.get_web3_payment_status(p_payment_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_payment jsonb;
  v_pending jsonb;
  v_latest_event jsonb;
BEGIN
  -- Get payment
  SELECT jsonb_build_object(
    'id', p.id,
    'user_id', p.user_id,
    'provider', p.provider,
    'status', p.status,
    'chain_id', p.chain_id,
    'wallet_address', p.wallet_address,
    'amount_cents', p.amount_cents,
    'block_confirmations', p.block_confirmations
  ) INTO v_payment
  FROM public.payments p
  WHERE p.id = p_payment_id;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('error', 'Payment not found');
  END IF;

  -- Get pending confirmation status
  SELECT jsonb_build_object(
    'current_confirmations', pc.current_confirmations,
    'required_confirmations', pc.required_confirmations,
    'is_finalized', pc.is_finalized,
    'last_checked_at', pc.last_checked_at
  ) INTO v_pending
  FROM public.web3_pending_confirmations pc
  WHERE pc.payment_id = p_payment_id;

  -- Get latest webhook event
  SELECT jsonb_build_object(
    'event_type', we.event_type,
    'block_number', we.block_number,
    'confirmations', we.confirmations,
    'received_at', we.received_at
  ) INTO v_latest_event
  FROM public.web3_webhook_events we
  WHERE we.payment_id = p_payment_id
  ORDER BY we.received_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'payment', v_payment,
    'pending', v_pending,
    'latest_event', v_latest_event
  );
END;
$$ LANGUAGE plpgsql;

-- ── 7. Function: Mark Web3 payment as confirmed ──────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_web3_payment(
  p_payment_id uuid,
  p_block_confirmations integer DEFAULT 0
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_amount_cents integer;
  v_result jsonb;
BEGIN
  -- Get payment details
  SELECT user_id, amount_cents INTO v_user_id, v_amount_cents
  FROM public.payments
  WHERE id = p_payment_id AND provider = 'web3';

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Web3 payment not found');
  END IF;

  -- Update payment status
  UPDATE public.payments
  SET 
    status = 'completed',
    block_confirmations = p_block_confirmations,
    completed_at = now(),
    updated_at = now()
  WHERE id = p_payment_id;

  -- Mark pending confirmation as finalized
  UPDATE public.web3_pending_confirmations
  SET 
    is_finalized = true,
    current_confirmations = p_block_confirmations,
    finalized_at = now()
  WHERE payment_id = p_payment_id;

  -- Update auto payment session if exists
  UPDATE public.web3_auto_payment_sessions
  SET 
    status = 'confirmed',
    payment_id = p_payment_id,
    updated_at = now()
  WHERE user_id = v_user_id AND status IN ('submitted', 'awaiting_signature');

  v_result := jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'user_id', v_user_id,
    'amount_cents', v_amount_cents,
    'completed_at', now()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ── 8. Grant permissions ────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.web3_webhook_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.web3_pending_confirmations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.web3_auto_payment_sessions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_web3_payment_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_web3_payment(uuid, integer) TO anon, authenticated;
