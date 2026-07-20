# Auth + Paywall Redesign — Specification

Status: Draft

## Goals
- Replace fragile client-side bootstrapping with a server-authoritative auth+paywall model.
- Ensure new users cannot bypass paywall during bootstrap.
- Make account state and payment status the single source of truth on the server.
- Improve security (RLS/policies), observability, and developer ergonomics.
- Provide an incremental migration path and tests so changes are safe to deploy.

## High-level principles
- Single client-side `AuthService` wraps a single Supabase client instance and centralizes all auth interactions. Avoid multiple GoTrueClient instances.
- All access gating decisions are based on server-authoritative data returned by an RPC (e.g. `get_session_profile(p_user_id)`), not heuristics in the UI.
- `payment_status` is canonical: enum { `pending`, `unpaid`, `active`, `cancelled`, `suspended` }.
- Never mark a profile `active` or `free` on client bootstrap. The server decides.
- Use Supabase RLS / Postgres policies and/or edge middleware to prevent client from reading/writing protected resources without proper entitlements.
- Webhooks and background jobs update authoritative payment records and profiles.

## Data model (profile + payments)
- `profiles` (existing) — additions/clarity:
  - `id` UUID PK
  - `email` text
  - `full_name` text
  - `payment_status` text enum (`pending`, `unpaid`, `active`, `cancelled`, `suspended`)
  - `subscription_tier` text (`pending`, `free`, `pro`, ...)
  - `account_activated` boolean
  - `platform_account_id` uuid (nullable)
  - `last_payment_at` timestamptz
  - `payment_metadata` jsonb
  - RLS: disallow client-side updates to `payment_status`, `subscription_tier` (only server functions/webhooks)

- `payments`
  - `id` uuid PK
  - `user_id` uuid FK -> profiles
  - `provider` text (stripe, paystack, opay, web3)
  - `provider_payment_id` text
  - `status` enum (`initiated`, `processing`, `succeeded`, `failed`, `refunded`)
  - `amount`, `currency` etc.
  - `metadata` jsonb
  - Timestamps, indexes on `user_id`

- `subscriptions` (optional)
  - `id`, `user_id`, `tier`, `status`, `starts_at`, `ends_at`

## Server-side RPCs / functions
1. `get_session_profile(p_user_id uuid)` RETURNS `profile_with_enforcement`:
   - Purpose: Return the current authoritative profile plus enforcement flags.
   - Implementation: SECURITY DEFINER function that composes `profiles` row, latest subscription/payment state, and enforcement signals (`error` fields like ACCOUNT_SUSPENDED).
   - Usage: Called by client immediately after successful sign-in and periodically for enforcement.

2. `verify_payment(provider text, provider_payment_id text)` RETURNS `payment_verification_result`:
   - Purpose: Server-side verification to confirm a payment, update `payments` and `profiles.payment_status` safely.

3. Webhook endpoints (HTTP functions) for payment providers:
   - Parse provider webhook → call `verify_payment` or upsert `payments` → set `profiles.payment_status` and `last_payment_at` atomically.

4. `end_my_live_sessions(p_user_id uuid)` and other domain RPCs remain server-side.

## AuthService (client-side)
- Singleton wrapper that exports:
  - `init(config)` — initialize supabase client once
  - `getSession()`
  - `onAuthStateChange(callback)` — centralizes handling of sign-in/sign-out/token refresh
  - `getProfile()` — calls server RPC `get_session_profile` and returns structured profile
  - `bootstrapProfile()` — ONLY calls a server endpoint to create minimal profile server-side (server decides defaults), not upserting `payment_status` from client
- Benefits:
  - Avoid multiple GoTrueClient instances warning
  - Central place to add logging, retries, PKCE exchange, and safe fallbacks

## Client AuthProvider & Paywall flow
1. User completes OAuth / sign-in (PKCE handled by `AuthService`).
2. `onAuthStateChange` detects a valid session and calls `AuthService.getProfile()`.
3. `get_session_profile` returns authoritative profile object and enforcement fields.
   - If RPC returns `error` flags (e.g. suspended), `AuthProvider` signs user out and shows messaging.
4. UI gating: `PaywallGate` reads `profile.payment_status`:
   - `active` → allow app
   - `pending`/`unpaid` → show paywall flow
   - `suspended` → show suspended message
5. Payment success events are processed server-side via webhook and then the client is notified either by polling RPC, by realtime update, or by optimistic client update only after server confirmation.

## Security and RLS
- Add Postgres RLS policies that:
  - Allow authenticated users to read their own `profiles` row but not to alter `payment_status` or `subscription_tier` from client.
  - Allow anonymous/public reads only for public tables (posts, news) if intentionally public.
- Use RPCs with `SECURITY DEFINER` when elevated privileges are required.
- Keep service-role keys server-side only (no client exposure).

## Migration steps (safe rollout)
1. Add `payment_status` enum values and new columns in `profiles` (nullable default `pending`).
2. Create `payments` table.
3. Deploy RPC `get_session_profile` and `verify_payment` functions.
4. Deploy client `AuthService` and `AuthProvider` refactor behind a feature flag.
5. Disable client bootstrap upsert of `payment_status` (we changed this already).
6. Roll out to staging; run integration tests and smoke tests.
7. Switch feature flag on in production.

## Observability
- Add server logs for `get_session_profile` calls and payment verification results.
- Add client logs (controlled by `__XEEVIA_DEBUG__`) for resolved Supabase URLs/keys and RPC durations.
- Add Sentry / error boundary capture for uncaught ReferenceErrors (like `v1 is not defined`) and include sourcemaps in staging.

## Testing
- Unit tests for `AuthService` and `AuthProvider` flows (mock supabase client + RPC results).
- Integration tests: sign-in → RPC returns `pending` → show paywall; simulate webhook → RPC returns `active` → allow app.
- E2E: Cypress or Playwright to cover end-to-end flows.

## Implementation plan (iterations)
1. Design doc (this file) — DONE
2. Implement `AuthService` singleton and small refactor of `supabase` initialisation (create `src/services/auth/AuthService.js`).
3. Implement `get_session_profile` SQL RPC on server (provide SQL file in `supabase/` folder). Add `verify_payment` stub.
4. Refactor `AuthProvider` to call `AuthService.getProfile()` and rely on `payment_status` from RPC.
5. Harden `PaywallGate` to use server-validated data and add redirect hooks.
6. Add tests and staging deployment.

## Files to add/modify (examples)
- `src/services/auth/AuthService.js` (new)
- `src/components/Auth/AuthContext.jsx` (refactor to use AuthService)
- `src/components/Auth/PaywallGate.jsx` (ensure server-authoritative gating)
- `supabase/sql/get_session_profile.sql` (new RPC)
- `supabase/sql/verify_payment.sql` (new RPC)

## Rollback plan
- Keep previous `AuthContext` as fallback branch/feature flag.
- If client-side regressions appear, flip feature flag and revert deploy while investigating.

---

If you approve, I'll implement step 2: create `AuthService` wrapper and refactor the existing `src/services/config/supabase.js` to export a single client used by `AuthService` and the rest of the app.
