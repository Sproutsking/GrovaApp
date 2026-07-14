# Secrets Migration Plan — Identity / Core / Wallet

Summary
- Map old single-project secrets into the three new Supabase projects: `identity`, `core`, `wallet`.
- Mark server-only secrets (service role keys, payment provider secrets) for Supabase Edge Functions / server usage. Keep publishable keys for the browser only.

Recommended mapping

- Identity project (server-only + auth-related)
  - Server-only (add to Supabase Project Secrets / Functions secrets):
    - `IDENTITY_SUPABASE_SERVICE_ROLE_KEY`
    - `IDENTITY_SUPABASE_URL` (if used by server code)
    - Email provider keys: `BREVO_API_KEY` / `RESEND_API_KEY` (if used by identity functions)
    - `VAPID_PRIVATE_KEY` (if push is sent from identity functions)
    - `ONESIGNAL_REST_API_KEY` (if notifications are sent server-side here)
  - Publishable / client-safe (add to Vercel / Netlify env for client builds):
    - `IDENTITY_SUPABASE_ANON_KEY` / `IDENTITY_SUPABASE_API_KEY`
    - `VAPID_PUBLIC_KEY`

- Core project (app DB, media, RPCs)
  - Server-only:
    - `CORE_SUPABASE_SERVICE_ROLE_KEY`
    - Any DB admin keys, Cloudinary secret keys used server-side
    - RPC service secrets used by core edge functions
  - Publishable / client-safe:
    - `CORE_SUPABASE_ANON_KEY`
    - `REACT_APP_R2_PUBLIC_URL` (public assets)

- Wallet project (payments and ledger)
  - Server-only (MUST NOT be exposed in browser):
    - `WALLET_SUPABASE_SERVICE_ROLE_KEY`
    - `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`, `OPAY_SECRET_KEY`
    - `LIVEKIT_API_SECRET` (if used server-side)
    - `TREASURY_WALLET_PRIVATE_KEY`, other custodial credentials
  - Publishable / client-safe (only publishable tokens):
    - `WALLET_SUPABASE_ANON_KEY`
    - `REACT_APP_PAYSTACK_PUBLIC_KEY`, `R2_PUBLIC_URL`, `VAPID_PUBLIC_KEY`

Cross-project notes
- Some secrets (e.g., Cloudinary upload preset or R2 public URLs) may be referenced in multiple projects — store in the project whose functions perform the upload, and add publishable values to client envs for other projects.
- Never commit service role keys or payment secrets to the repo. Use `supabase secrets set` for Edge Functions and inject runtime envs in server deployments.

Immediate actions (priority order)
1. Verify Redirect URLs in the Identity Supabase project include `https://app.xeevia.com/auth/callback` and `https://app.xeevia.xyz/auth/callback`.
2. Provision the following minimal secrets now (in respective projects) to allow bootstrapping:
   - `IDENTITY_SUPABASE_ANON_KEY` (client) and `IDENTITY_SUPABASE_SERVICE_ROLE_KEY` (functions)
   - `CORE_SUPABASE_ANON_KEY` and `CORE_SUPABASE_SERVICE_ROLE_KEY`
   - `WALLET_SUPABASE_ANON_KEY` and `WALLET_SUPABASE_SERVICE_ROLE_KEY`
3. Run E2E sign-in on `https://app.xeevia.com` and confirm `AuthCallback` completes and `AuthContext` loads profile.
4. Deploy and test wallet edge functions (webhooks) after adding payment provider secrets to the wallet project.

How to add secrets (example)
```
supabase secrets set IDENTITY_SUPABASE_SERVICE_ROLE_KEY="<value>" --project <identity-ref>
supabase secrets set CORE_SUPABASE_SERVICE_ROLE_KEY="<value>" --project <core-ref>
supabase secrets set WALLET_SUPABASE_SERVICE_ROLE_KEY="<value>" --project <wallet-ref>
```

Verification checklist
- [ ] All required `*_SERVICE_ROLE_KEY` variables present in each project's Secrets UI
- [ ] Identity project's Redirect URLs and Site URL set to canonical domain(s)
- [ ] No service role or payment secret appears in client bundles (search for keys in built artifacts)
- [ ] Edge functions that require secrets read the expected env var names (search repo for env var names before deploy)

Next steps I can take now
- Scan the repository for all distinct env var names and produce a CSV mapping (I can do this automatically).
- Create a secure checklist and a `supabase secrets set` script for each project (dry-run).
