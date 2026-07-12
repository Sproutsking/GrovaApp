## Summary
- Added a boundary-aware client audit and initial migration inventory under migration/
- Routed wallet/payment services to the wallet-specific Supabase client for wallet/payment table access
- Added smoke-test artifacts and migration docs for observability and cutover

## Validation
- npm ci
- npm run build
- node migration/tests/boundary-client-smoke.js

## Notes
- Supabase CLI is not installed in this environment, so edge-function secret and project-link validation are documented for CI/deployment execution rather than executed locally.
- No service-role, anon, or third-party secrets were committed to the repository.
