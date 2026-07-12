# Cutover runbook

## Preconditions
1. Confirm the identity, core, and wallet projects are reachable with the matching service-role credentials.
2. Confirm the edge functions are deployed to the correct project and the required secrets exist in CI secret storage.
3. Run the smoke suite against the staging environment before production cutover.

## Cutover steps
1. Deploy the latest edge functions to identity/core/wallet projects in sequence.
2. Push any DB changes to a staging project first; only promote to production after smoke tests pass.
3. Enable the new boundary-aware client wiring in the app build.
4. Run the smoke checks and validate wallet, profile, and feed flows.

## Rollback
- Revert the frontend build to the previous release.
- Re-deploy the previous edge-function bundle to the affected project.
- Restore the previous schema or use the latest backup if a database change needs to be rolled back.
