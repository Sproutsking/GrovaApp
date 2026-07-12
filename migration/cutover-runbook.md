# Supabase split cutover runbook

## Pre-checks
1. Confirm the identity/core/wallet project refs are available.
2. Confirm the required secrets are present in the target project secret store, not in the repository.
3. Verify the migration branch builds locally.
4. Run smoke checks against staging before production.

## Cutover steps
1. Deploy edge functions to the intended project.
2. Push schema changes to staging first, then production.
3. Switch runtime config to the per-boundary project URLs/anon keys.
4. Run smoke tests for auth, profile, feed, and wallet flows.

## Rollback
- Revert runtime env to the previous identity/core/wallet URLs and anon keys.
- Redeploy the previous edge function revision if necessary.
- Re-enable the prior database schema state from backup if a destructive migration caused issues.

## Smoke checks
- Auth sign-in/sign-out/refresh
- Profile create/read
- Feed fetch
- Wallet deposit/transaction confirmation
