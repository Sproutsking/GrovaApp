-- Migration 004: Backfill missing wallet_history.currency metadata
-- This migration only updates rows where metadata.currency is missing and
-- the asset or change reason gives us enough information to infer the correct
-- currency. It does not modify any historical financial amounts.

BEGIN;

-- Use existing metadata if present, otherwise infer from reason/transaction type
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

-- Make the new field explicit where there is any ambiguity repairable via known currency_type.
UPDATE wallet_history
SET metadata = jsonb_set(metadata, '{currency}', '"XEV"', true)
WHERE metadata->>'currency' IS NULL
  AND metadata->>'currency_type' = 'XEV';

UPDATE wallet_history
SET metadata = jsonb_set(metadata, '{currency}', '"EP"', true)
WHERE metadata->>'currency' IS NULL
  AND metadata->>'currency_type' = 'EP';

COMMIT;
