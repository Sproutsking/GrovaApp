-- Migration: Rename grova_tokens -> xev_tokens
-- WARNING: Run on a maintenance window. Ensure backups before applying.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wallets'
      AND column_name = 'grova_tokens'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wallets'
      AND column_name = 'xev_tokens'
  ) THEN
    ALTER TABLE public.wallets RENAME COLUMN grova_tokens TO xev_tokens;
  END IF;
END $$;

COMMIT;
