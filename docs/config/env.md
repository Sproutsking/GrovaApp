# Environment Variables & Secrets — Inventory

Purpose: definitive mapping of every environment variable used by Xeevia, why it exists, and where to rotate or remove it.

IMPORTANT: Treat all `REACT_APP_*` variables as public (front-end) variables. Do NOT store secrets in `REACT_APP_*` for server-side only secrets.

## Supabase (multi-instance)
- `IDENTITY_SUPABASE_URL`, `IDENTITY_SUPABASE_ANON_KEY`, `IDENTITY_SUPABASE_SERVICE_ROLE_KEY` — Identity Supabase project config. Use for auth, MFA, OAuth/Xeevia, sessions, and recovery.
- `CORE_SUPABASE_URL`, `CORE_SUPABASE_ANON_KEY`, `CORE_SUPABASE_SERVICE_ROLE_KEY` — Core Supabase project config. Use for content, profiles, feeds, communities, and realtime.
- `WALLET_SUPABASE_URL`, `WALLET_SUPABASE_ANON_KEY`, `WALLET_SUPABASE_SERVICE_ROLE_KEY` — Wallet Supabase project config. Use for payments, ledgers, and payout flows.

The implementation scaffold is in [src/services/supabase/multiClient.js](src/services/supabase/multiClient.js) and the working log is in [docs/IMPLEMENTATION_LOG.md](docs/IMPLEMENTATION_LOG.md).

- `REACT_APP_SUPABASE_IDENTITY_URL` — Identity Supabase project public URL. Used by front-end to perform auth calls and by server-side to resolve endpoints for auth flows.
- `REACT_APP_SUPABASE_IDENTITY_KEY` — Public anon key for identity project (not a service_role). Use only in browser code. Keep `SUPABASE_SERVICE_ROLE` in server envs only.

- `REACT_APP_SUPABASE_CORE_URL` — Core Supabase project public URL. Used for content reads/writes (posts, comments, realtime).
- `REACT_APP_SUPABASE_CORE_KEY` — Public anon key for core project.

- `REACT_APP_SUPABASE_WALLET_URL` — Wallet Supabase project public URL. Used by wallet UI for read-only and limited writes; server-side operations must use service role.
- `REACT_APP_SUPABASE_WALLET_KEY` — Public anon key for wallet project.

## Supabase server keys (server-only; NOT in front-end)
- `SUPABASE_SERVICE_ROLE` — Full-privilege key. Store in server environment only (edge functions, server). Never commit or expose.
- `SUPABASE_IDENTITY_SERVICE_ROLE`, `SUPABASE_CORE_SERVICE_ROLE`, `SUPABASE_WALLET_SERVICE_ROLE` — Optional per-project service role keys (recommended) for migration and backend jobs.

## Cloudinary (multi-account)
- `CLOUD_PROFILES_NAME` — Cloudinary cloud name for profile images (avatars, covers).
- `CLOUD_PROFILES_KEY` — API key for profiles account (server-only if upload signed URLs are used).
- `CLOUD_PROFILES_SECRET` — API secret for profiles account (server-only).

- `CLOUD_CONTENT_NAME` — Cloudinary cloud name for general content (post images).
- `CLOUD_CONTENT_KEY` — API key for content account.
- `CLOUD_CONTENT_SECRET` — API secret for content account.

- `CLOUD_REELS_NAME` — Cloudinary cloud name for large video assets (reels).
- `CLOUD_REELS_KEY` — API key for reels account.
- `CLOUD_REELS_SECRET` — API secret for reels account.

- `CLOUD_ADMIN_NAME` — Cloudinary cloud name for admin/backups.
- `CLOUD_ADMIN_KEY` — API key for admin account.
- `CLOUD_ADMIN_SECRET` — API secret for admin account.

## Payment providers & webhooks (server-only)
- `STRIPE_SECRET_KEY` — Stripe secret for payments (server-only). Rotate on compromise.
- `PAYSTACK_SECRET_KEY` — Paystack secret (server-only).
- `PAYSTACK_PUBLIC_KEY` — Public key (front-end usage for client-side flows).

## Push & Notifications
- `ONESIGNAL_APP_ID` — OneSignal App ID for push targeting.
- `ONESIGNAL_API_KEY` — Server key for sending pushes.

## Messaging & SMS
- `TWILIO_SID` — Twilio account SID (server-only)
- `TWILIO_AUTH_TOKEN` — Twilio auth token (server-only)
- `TWILIO_PHONE_NUMBER` — Sender number

## Third-party APIs (examples)
- `REACT_APP_CLOUDINARY_CLOUD_NAME` — (legacy single-cloud usage) Used in `src/services/shared/mediaUrlService.js`. If migrating to `CLOUD_*` variables above, remove this after migration.
- `REACT_APP_SENDGRID_API_KEY` — Email sending (if used)
- `REACT_APP_EMAILJS_USER` — EmailJS public key (if client-side template posting used)

## Legacy / Deprecated (audit and remove when confirmed)
- `REACT_APP_OLD_FIREBASE_API_KEY` — Legacy; remove if no Firebase usage.
- `REACT_APP_LEGACY_AUTH_ENDPOINT` — Legacy auth endpoint; archive and remove.
- `REACT_APP_STRIPE_OLD_SECRET` — Old Stripe secret; remove after verifying current flows.
- `REACT_APP_CLOUDINARY_CLOUD_NAME` — (if multi-cloud implemented) replace with `CLOUD_*` variables and then delete.

---

## Rotation & Storage Recommendations
- Server-only secrets: store in host provider secrets (Vercel/Netlify/GCP Secret Manager). Do NOT expose as `REACT_APP_*`.
- Rotate payment provider secrets every 90 days or immediately upon suspicion.
- Keep a `SECRETS.md` (encrypted) mapping who has access and the last rotation timestamp.


## Quick checks — find where a var is used
Run this from repo root to find usage of a variable (example: `REACT_APP_CLOUDINARY_CLOUD_NAME`):

```bash
grep -R "REACT_APP_CLOUDINARY_CLOUD_NAME" -n src || true
```


End of env inventory.
