-- Migration: Rename grova_tokens -> xev_tokens
-- WARNING: Run on a maintenance window. Ensure backups before applying.

BEGIN;

-- Rename column in wallets
ALTER TABLE public.wallets RENAME COLUMN grova_tokens TO xev_tokens;

-- If there are views, functions, or triggers that reference the old column,
-- update them accordingly. Example (uncomment and adapt if needed):
-- CREATE OR REPLACE FUNCTION public.update_wallets_trigger() RETURNS trigger AS $$
-- BEGIN
--   -- function body that references xev_tokens instead of grova_tokens
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

COMMIT;
