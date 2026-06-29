-- ============================================================================
-- PayWave Complete System Migration
-- Adds transaction fee management, XRC Oracle tracking, and fixes history
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TRANSACTION FEE CONFIGURATION (CEO/Super Admin Only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paywave_fee_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['airtime'::text, 'data'::text, 'electricity'::text, 'cable'::text, 'transfer'::text, 'deposit'::text, 'withdrawal'::text, 'flutterwave'::text])),
  fee_percentage numeric NOT NULL DEFAULT 0 CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
  min_amount numeric DEFAULT 0,
  max_amount numeric,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT paywave_fee_config_pkey PRIMARY KEY (id),
  CONSTRAINT paywave_fee_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paywave_fee_config_type ON public.paywave_fee_config(transaction_type) WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PAYWAVE TRANSACTIONS TABLE (Consolidated)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paywave_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['airtime'::text, 'data'::text, 'electricity'::text, 'cable'::text, 'transfer'::text, 'deposit'::text, 'withdrawal'::text, 'receive'::text])),
  amount numeric NOT NULL CHECK (amount > 0),
  fee_amount numeric NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount numeric NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])),
  provider text,
  recipient_phone text,
  recipient_name text,
  recipient_account text,
  provider_transaction_id text UNIQUE,
  reference_id text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  xrc_record_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT paywave_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT paywave_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT paywave_transactions_xrc_record_id_fkey FOREIGN KEY (xrc_record_id) REFERENCES public.xrc_records(record_id)
);

CREATE INDEX IF NOT EXISTS idx_paywave_transactions_user_id ON public.paywave_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_paywave_transactions_created_at ON public.paywave_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paywave_transactions_status ON public.paywave_transactions(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. XRC ORACLE TRANSACTION TRACKING (Blockchain Verification)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.xrc_paywave_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  xrc_record_id uuid NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'failed'::text])),
  block_number bigint,
  block_timestamp bigint,
  transaction_hash text UNIQUE,
  proof_data jsonb DEFAULT '{}'::jsonb,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT xrc_paywave_records_pkey PRIMARY KEY (id),
  CONSTRAINT xrc_paywave_records_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.paywave_transactions(id),
  CONSTRAINT xrc_paywave_records_xrc_record_id_fkey FOREIGN KEY (xrc_record_id) REFERENCES public.xrc_records(record_id)
);

CREATE INDEX IF NOT EXISTS idx_xrc_paywave_records_transaction_id ON public.xrc_paywave_records(transaction_id);
CREATE INDEX IF NOT EXISTS idx_xrc_paywave_records_verification_status ON public.xrc_paywave_records(verification_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ADMIN AUDIT LOG FOR FEE CHANGES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paywave_admin_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  old_values jsonb DEFAULT '{}'::jsonb,
  new_values jsonb DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT paywave_admin_audit_pkey PRIMARY KEY (id),
  CONSTRAINT paywave_admin_audit_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INITIALIZE DEFAULT FEE STRUCTURE
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.paywave_fee_config (transaction_type, fee_percentage, description, is_active)
VALUES 
  ('airtime', 2.5, 'Airtime purchase fee', true),
  ('data', 2.5, 'Data bundle purchase fee', true),
  ('electricity', 3.0, 'Electricity bill payment fee', true),
  ('cable', 3.0, 'Cable TV subscription fee', true),
  ('transfer', 0.0, 'In-app money transfer fee', true),
  ('deposit', 0.0, 'Deposit to PayWave wallet fee', true),
  ('withdrawal', 1.5, 'Bank withdrawal fee', true),
  ('flutterwave', 2.0, 'Flutterwave transaction fee', true)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Get applicable fee for transaction type
CREATE OR REPLACE FUNCTION public.get_paywave_fee(
  p_transaction_type text,
  p_amount numeric
) RETURNS numeric AS $$
BEGIN
  RETURN COALESCE(
    (SELECT fee_percentage FROM paywave_fee_config
     WHERE transaction_type = p_transaction_type
       AND is_active = true
       AND (min_amount IS NULL OR p_amount >= min_amount)
       AND (max_amount IS NULL OR p_amount <= max_amount)
     LIMIT 1),
    0
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Record PayWave transaction with fee calculation
CREATE OR REPLACE FUNCTION public.create_paywave_transaction(
  p_user_id uuid,
  p_transaction_type text,
  p_amount numeric,
  p_provider text DEFAULT NULL,
  p_recipient_phone text DEFAULT NULL,
  p_recipient_name text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb AS $$
DECLARE
  v_fee_pct numeric;
  v_fee_amount numeric;
  v_net_amount numeric;
  v_tx_id uuid;
  v_ref_id text;
BEGIN
  -- Calculate fee
  v_fee_pct := get_paywave_fee(p_transaction_type, p_amount);
  v_fee_amount := ROUND((p_amount * v_fee_pct / 100)::numeric, 2);
  v_net_amount := p_amount - v_fee_amount;
  
  -- Generate reference
  v_ref_id := p_transaction_type || '_' || to_char(NOW(), 'YYYYMMDDHHmmss') || '_' || substr(gen_random_uuid()::text, 1, 8);
  
  -- Insert transaction
  INSERT INTO paywave_transactions(
    user_id, transaction_type, amount, fee_amount, net_amount, status,
    provider, recipient_phone, recipient_name, reference_id, metadata
  )
  VALUES(
    p_user_id, p_transaction_type, p_amount, v_fee_amount, v_net_amount, 'pending',
    p_provider, p_recipient_phone, p_recipient_name, v_ref_id, p_metadata
  )
  RETURNING id INTO v_tx_id;
  
  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'reference_id', v_ref_id,
    'amount', p_amount,
    'fee_amount', v_fee_amount,
    'net_amount', v_net_amount,
    'fee_percentage', v_fee_pct,
    'status', 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update transaction fee config (CEO/Super Admin only)
CREATE OR REPLACE FUNCTION public.update_paywave_fee_config(
  p_admin_id uuid,
  p_transaction_type text,
  p_new_fee_percentage numeric,
  p_reason text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_admin_role text;
  v_old_fee numeric;
  v_success boolean;
BEGIN
  -- Check admin role (CEO or super_admin only)
  SELECT role INTO v_admin_role FROM admin_team WHERE user_id = p_admin_id;
  
  IF v_admin_role NOT IN ('ceo_owner', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. CEO or Super Admin access required.');
  END IF;
  
  -- Get old fee
  SELECT fee_percentage INTO v_old_fee FROM paywave_fee_config 
  WHERE transaction_type = p_transaction_type AND is_active = true;
  
  -- Update
  UPDATE paywave_fee_config 
  SET fee_percentage = p_new_fee_percentage, updated_at = NOW(), updated_by = p_admin_id
  WHERE transaction_type = p_transaction_type AND is_active = true;
  
  -- Audit log
  INSERT INTO paywave_admin_audit(admin_id, action, target_type, old_values, new_values, reason)
  VALUES(
    p_admin_id,
    'update_fee',
    'paywave_fee_config',
    jsonb_build_object('fee_percentage', v_old_fee),
    jsonb_build_object('fee_percentage', p_new_fee_percentage),
    p_reason
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_type', p_transaction_type,
    'old_fee_percentage', v_old_fee,
    'new_fee_percentage', p_new_fee_percentage
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
