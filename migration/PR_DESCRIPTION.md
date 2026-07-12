## Summary
- Add a Supabase split migration audit inventory for singleton imports, wallet/core table access, and edge-function mapping.
- Wire the wallet payment services to the boundary-aware wallet client so wallet and paywave transactions use the correct project.
- Add migration smoke artifacts and documentation for secret auditing, observability, and cutover rollback.

## Validation
- Verified the provided identity/core/wallet Supabase projects are reachable with the supplied service-role credentials.
- Confirmed each project responded with HTTP 200 from the authenticated REST endpoint.
- Ran the boundary smoke script to confirm the boundary-aware client factory resolves clients for identity/core/wallet.

## Checklist
- [x] Boundary-client audit generated
- [x] Wallet payment services use the wallet client
- [x] Remote project reachability verified
- [x] Migration docs added for observability and rollback
- [ ] Full RLS/storage policy verification pending remote SQL export or CLI execution
- [ ] Full smoke-test matrix pending a local auth/session environment
