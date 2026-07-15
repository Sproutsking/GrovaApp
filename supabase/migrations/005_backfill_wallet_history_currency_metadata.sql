-- Migration 005: Backfill missing wallet_history.currency metadata
-- This migration only updates rows where metadata.currency is missing and
-- the asset or change reason gives us enough information to infer the correct
-- currency. It does not modify any historical financial amounts.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'wallet_history'
  ) THEN
    UPDATE wallet_history
    SET metadata = jsonb_set(metadata, '{currency}', '"XEV"', true)
    WHERE metadata->>'currency' IS NULL
      AND (
        metadata->>'currency_type' = 'XEV'
        OR metadata->>'asset' = 'XEV'
        OR reason ILIKE '%xev%'
        OR reason ILIKE '%on_chain%'
        OR reason ILIKE '%P2P Trade%'
        OR reason ILIKE '%wallet_deposit%'
      );

    UPDATE wallet_history
    SET metadata = jsonb_set(metadata, '{currency}', '"EP"', true)
    WHERE metadata->>'currency' IS NULL
      AND (
        metadata->>'currency_type' = 'EP'
        OR reason ILIKE '%EP%'
        OR reason ILIKE '%purchase_grant%'
        OR change_type = 'credit' AND (metadata->>'source') = 'wallet_deposit'
      );

    UPDATE wallet_history
    SET metadata = jsonb_set(metadata, '{currency}', '"XEV"', true)
    WHERE metadata->>'currency' IS NULL
      AND metadata->>'currency_type' = 'XEV';

    UPDATE wallet_history
    SET metadata = jsonb_set(metadata, '{currency}', '"EP"', true)
    WHERE metadata->>'currency' IS NULL
      AND metadata->>'currency_type' = 'EP';
  END IF;
END $$;

COMMIT;
