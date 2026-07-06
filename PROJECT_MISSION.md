Project Mission — GrovaApp / Xeevia

What we're building
- A creator-first social distribution platform that securely connects a user's cross-platform social identities, verifies tokens, and lets creators publish and manage audience transitions across platforms while preserving privacy and permissions.
- Key capabilities: secure server-side token storage (AES-GCM), edge-function-based publish/verify pipeline, identity sync job processing, evidence-driven relationship graphs, and a premium dashboard for audience transition playbooks.

The void we're fixing
- Fragmented identity across social platforms: tokens and connections are often stored insecurely or handled inconsistently client-side.
- Poor verification and auditing: token verification and sync jobs are often stubbed, leading to fragile integrations and lost audit trails.
- Weak permission models for cross-platform graphing: relationship graphs expose sensitive connections unless explicitly permissioned.
- Lack of end-to-end flow: connecting, verifying, publishing, syncing, and surfacing insights are typically fragmented across multiple services.

What greatness we discovered and will deliver
- A unified, secure token pipeline that centralizes encryption/decryption server-side and provides safe fallbacks for development.
- An idempotent identity-sync job processor that verifies tokens, logs results, and provides traceable sync logs.
- A permission-gated relationship graph enabling meaningful audience context without revealing private connections.
- A developer-friendly approach that keeps UI and verification tooling separate so the verification dashboard and the new identity/graph surfaces don't interfere.

Immediate goals for this sprint
1. Fix all test failures and build issues to reach a green CI build.
2. Harden mocks and services used by unit tests (OneSignal, Opay) so tests are deterministic.
3. Ensure the new edge-function-backed flows compile and run locally (build+tests).
4. Commit and push all fixes with clear commit messages.

How to verify locally
- Install dependencies: `npm install --legacy-peer-deps`
- Run tests in CI mode: `CI=true npm test -- --watchAll=false`
- Build production bundle: `npm run build`

Notes
- Edge functions live under `supabase/functions` and require Supabase environment vars to run; unit tests are isolated and will be fixed to not require live Supabase.
- If you want, next I will fix the remaining failing tests and push commits. "}, 