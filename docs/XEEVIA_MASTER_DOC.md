# XEEVIA Master Implementation & Handoff Document

Purpose: a single, machine- and human-readable source-of-truth that explains
- what Xeevia is,
- exactly what exists in this repository and runtime, and
- the precise steps, SQL, API endpoints, configuration, and scripts required for an engineer or an AI to continue building or operate the system.

This file is intentionally prescriptive and concrete. Follow it to bootstrap, test, or extend Xeevia.

---

**Quick links**
- Code: `src/` (React app + services)
- Services: `src/services/` (auth, xrc, wallet, notifications)
- Supabase config: `supabase/config.toml`
- Migrations: `migrations/`
- Created docs: `docs/` (this file)
- Master architecture notes: `XEEVIA_ARCHITECTURE_STRATEGY.md`

---

SECTION A — What Xeevia Is (brief)

Xeevia is a trust-infrastructure platform with a social/content front-end, a participation economy (EP), and an evidence/verification layer (XRC). It combines identity, media, content, wallets, and evidence storage into a single product. The repo contains the full React front-end, service modules for auth, xrc, wallets, and Supabase migrations and functions.


SECTION B — What exists (inventory)

1) Frontend
- Root: `src/App.jsx`, `src/index.js` — React PWA entry
- Auth UX: `src/components/Auth/*` — sign in flows, OAuth callbacks
- Account & Security: `src/components/Account/*` — profile, settings, 2FA modal
- Wallet: `src/components/wallet/*` — deposit/withdraw/paywave UI
- Media: `src/components/MediaUploader/*` — uploader/editor, share modal

2) Services (important)
- `src/services/auth/authService.js` — high-level auth wrappers
- `src/services/xrc/*` — evidence chain and XRC services
- `src/services/connections/*` and `src/services/connectors/*` — social connectors
- `src/services/notifications/*` — push and prompt logic
- `src/services/shared/mediaUrlService.js` — cloudinary integration (single-cloud currently)

3) Backend / infra
- `supabase/` and `migrations/` — supabase function templates and SQL migrations
- `supabase/config.toml` — local supabase config
- `vercel.json`, deploy scripts in `scripts/`

4) Data model
- Full schema (138 tables) captured in repository README/migration context and provided earlier. Key domains: `profiles`, `wallets`, `posts`, `reels`, `stories`, `payments`, `xrc_records`, `live_sessions`, `notifications`, `messages`, `communities`.

5) Secrets usage snapshot
- Cloudinary keys referenced via `process.env.REACT_APP_CLOUDINARY_*`
- Supabase clients under `src/config/supabase` (uses environment variables)
- External providers: Twilio/OneSignal/Stripe/Paystack referenced in `src/services/wallet` and `src/services/notifications`


SECTION C — What Xeevia needs (concrete list)

Goal: clear, unambiguous tasks that convert the codebase into an easily scaled, auditable, and automatable platform.

High-priority technical needs (ordered):
1. OAuth provider implementation inside Xeevia (so other apps can rely on Xeevia identity).
2. Comprehensive MFA support (TOTP + SMS + Email + WebAuthn + recovery codes + device trust).
3. Data domain separation (three Supabase projects: identity, core, wallet) with migration scripts.
4. Multi-Cloudinary accounts with `multiCloudinaryService` and a migration plan.
5. Documentation program (auto-generated table reference, service inventory, runbooks, ADRs).
6. Enable and expose real-time features already wired in code (presence, typing, viewer counts).
7. Evidence visualization (user trust score UI driven by XRC records).


SECTION D — Concrete file changes to add now (what I'm creating next)
- `docs/XEEVIA_MASTER_DOC.md` (this file)
- `docs/schema/TABLES_DETAILED.md` (auto-generated mapping of tables → purpose)
- `docs/config/env.md` (full env var & secret audit)
- `supabase/functions/oauth-authorize/index.js` (edge function stub)
- `supabase/functions/oauth-token/index.js` (edge function stub)
- `src/services/auth/oauthProviderClient.js` (server-side helper)
- `src/services/shared/multiCloudinaryService.js` (upload abstraction)


SECTION E — OAuth provider spec (developer-ready)

Overview: implement standard OAuth2 Authorization Code + PKCE flows for public clients and Authorization Code flow for confidential clients. Minimal endpoints:

1) GET `/oauth/authorize?client_id=...&redirect_uri=...&scope=...&state=...&response_type=code&code_challenge=...&code_challenge_method=S256`
   - Validate `client_id`, `redirect_uri` must match stored redirect URIs
   - If not logged in -> redirect to `auth/callback` with login flow
   - If logged in -> show consent UI listing scopes
   - On approval: create short-lived `code` row in `oauth_codes` table, redirect back: `redirect_uri?code=...&state=...`

2) POST `/oauth/token` — body x-www-form-urlencoded
   - `grant_type=authorization_code` + `code` + `redirect_uri` + `client_id` (+ `client_secret` for confidential)
   - Validate code exists, not expired, redirect_uri matches, PKCE verifier if applicable
   - On success: issue `access_token` (JWT or opaque random token), `refresh_token`, save into `oauth_tokens` table
   - Response JSON: { access_token, token_type: 'bearer', expires_in, refresh_token, scope }

3) GET `/oauth/userinfo` — header: `Authorization: Bearer <access_token>`
   - Validate token, return JSON for scopes requested
   - Example response for `scope=profile email`: { id, email, username, full_name, avatar_url }

4) Token introspection and revocation endpoints (optional but recommended): `/oauth/introspect`, `/oauth/revoke`

SQL: create tables used by OAuth (run in `SUPABASE-IDENTITY` schema)

```sql
CREATE TABLE public.oauth_clients (
  client_id text PRIMARY KEY,
  client_name text NOT NULL,
  client_secret_hash text,
  redirect_uris text[] NOT NULL,
  owner_id uuid REFERENCES public.profiles(id),
  is_confidential boolean DEFAULT true,
  scopes text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.oauth_codes (
  code text PRIMARY KEY,
  client_id text REFERENCES public.oauth_clients(client_id),
  user_id uuid REFERENCES public.profiles(id),
  code_challenge text,
  code_challenge_method text,
  redirect_uri text,
  scope text[],
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.oauth_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES public.oauth_clients(client_id),
  user_id uuid REFERENCES public.profiles(id),
  access_token text UNIQUE NOT NULL,
  refresh_token text UNIQUE,
  scope text[],
  expires_at timestamptz NOT NULL,
  revoked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

Edge function stub (Node): `supabase/functions/oauth-authorize/index.js`

```js
// Minimal example for authorize endpoint in Supabase Edge Function
import { serve } from 'std/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE'));

serve(async (req) => {
  const url = new URL(req.url);
  const client_id = url.searchParams.get('client_id');
  const redirect_uri = url.searchParams.get('redirect_uri');
  // Validate client_id, redirect_uri
  // If not logged in, redirect to login with return URL
  // If logged in and consent given, insert oauth_codes row and redirect back with code
  return new Response('Not implemented', { status: 501 });
});
```

Edge function stub (token): `supabase/functions/oauth-token/index.js`
```js
// POST /oauth/token
import { serve } from 'std/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE'));

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method', { status: 405 });
  const form = await req.formData();
  const grant_type = form.get('grant_type');
  // handle grant_type=authorization_code, validate code, issue tokens
  return new Response(JSON.stringify({ error: 'Not implemented' }), { status: 501 });
});
```

Notes: Use the Supabase `service_role` key for server-side validation only. Access token policy: keep access token lifetime short (1h) and use refresh tokens for long-lived sessions. Store refresh tokens hashed if you want to avoid storing plaintext.


SECTION F — MFA implementation (prescriptive)

High-level: centralize MFA logic in `src/services/auth/mfaService.js` (server-side code in edge functions). Use `verification_codes` table for short-lived OTP codes, and `two_factor_auth` table for user secrets and recovery.

Design details:

1) TOTP (existing)
- Use `otpauth` or `otplib` to generate shared secret
- Store `two_factor_auth.secret` hashed or encrypted with a server key
- QR flow: generate `otpauth://totp/Xeevia:user@example.com?secret=...&issuer=Xeevia`

2) SMS OTP
- Use `verification_codes` table with rows: { id, email(phone), code_hash, code_type='phone_verify', expires_at }
- Send using Twilio (server-only). Limit to 3 sends per hour.
- Verify by comparing hash(code) with stored `code_hash` and mark as used.

3) Email OTP
- Same flow but use EmailJS or SendGrid. Use email templates with `{{code}}`.

4) WebAuthn
- `webauthn_credentials` table:
```sql
CREATE TABLE public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),
  credential_id bytea UNIQUE NOT NULL,
  public_key text NOT NULL,
  transports text[],
  device_name text,
  created_at timestamptz DEFAULT now()
);
```
- Use `@simplewebauthn/server` for challenge generation & verification

5) Recovery codes
- Generate 16 unique strings for the user, store their hashes in `two_factor_auth.backup_codes` as hashed array
- On use, mark as consumed and record `two_factor_auth.last_used`

6) Device trust
- When enabling "Trust this device" create `trusted_devices_enhanced` row with `expires_at = now()+30d` and a token cookie stored on device (httpOnly). If cookie + fingerprint exist, allow skip of 2FA within expiry.


SECTION G — Multi-Supabase migration: exact steps (runnable)

Assumptions:
- You have CLI access and appropriate privileges to create new Supabase projects.
- We'll call the new projects `grova-identity`, `grova-core`, `grova-wallet`.

Step 0: Backup existing DB (always)

```bash
# Replace placeholders with your URL, user, and database
PG_URL="postgres://postgres:password@db.supabase.co:5432/postgres"
pg_dump --format=custom --file=backup-full.dump "$PG_URL"
```

Step 1: Create three new Supabase projects via the dashboard or `supabase` CLI.

Step 2: Run schema split scripts (we'll add migration files under `migrations/identity.sql`, `migrations/core.sql`, `migrations/wallet.sql`). Example command (requires `supabase` CLI linked to project):

```bash
supabase link --project-ref <IDENTITY_REF>
supabase db push --schema migrations/identity.sql

supabase link --project-ref <CORE_REF>
supabase db push --schema migrations/core.sql

supabase link --project-ref <WALLET_REF>
supabase db push --schema migrations/wallet.sql
```

Step 3: Data migration
- Use selective `pg_dump --table=... --data-only` for each table group and `psql` to restore. Example for `profiles`:

```bash
pg_dump --data-only --table=public.profiles "$PG_URL" | psql "postgres://<IDENTITY_DB_URL>"
```

Step 4: Service config
- Add environment variables for new Supabase projects in Vercel/Netlify/CI:

```
# SUPABASE (IDENTITY) — authentication, user profiles, MFA, OAuth provider
REACT_APP_SUPABASE_IDENTITY_URL=https://identity-xxxxx.supabase.co
REACT_APP_SUPABASE_IDENTITY_KEY=public-anon-key

# SUPABASE (CORE) — public content, feeds, communities, messages, realtime
REACT_APP_SUPABASE_CORE_URL=https://core-xxxxx.supabase.co
REACT_APP_SUPABASE_CORE_KEY=public-anon-key

# SUPABASE (WALLET) — payments, transactions, subscriptions, audit logs
REACT_APP_SUPABASE_WALLET_URL=https://wallet-xxxxx.supabase.co
REACT_APP_SUPABASE_WALLET_KEY=public-anon-key

# Notes:
# - Use the IDENTITY project for anything auth/security-sensitive (2FA, oauth, sessions).
# - Use CORE for high-volume content tables (posts, reels, comments) and realtime features.
# - Use WALLET for finance-related tables (payments, transactions, wallet_history). Keep stronger access controls and rotation policies.
```

Step 5: Feature flag rollout
- Add small adapter `src/services/supabase/multiClient.js` to route queries to the correct project based on table mapping. Start with read-only traffic to the new projects; then switch progressively.


SECTION H — Multi-Cloudinary: practical migration

Plan:
1. Create four Cloudinary accounts: `xeevia-profiles`, `xeevia-content`, `xeevia-reels`, `xeevia-admin`.
2. Add keys to env (see `docs/config/env.md`)
3. Implement `src/services/shared/multiCloudinaryService.js` abstraction (uploader + URL builder)

Uploader stub (Node/JS):

```js
import cloudinary from 'cloudinary';

export class MultiCloudinary {
  constructor() {
    this.profiles = cloudinary.v2.config({ cloud_name: process.env.CLOUD_PROFILES_NAME, api_key: process.env.CLOUD_PROFILES_KEY, api_secret: process.env.CLOUD_PROFILES_SECRET });
    this.content = cloudinary.v2.config({ cloud_name: process.env.CLOUD_CONTENT_NAME, api_key: process.env.CLOUD_CONTENT_KEY, api_secret: process.env.CLOUD_CONTENT_SECRET });
    // use runtime switch when calling uploader
  }

  async uploadProfileImage(file, userId) {
    return cloudinary.v2.uploader.upload(file, { folder: `profiles/${userId}` });
  }

  async uploadPostImage(file, userId) {
    return cloudinary.v2.uploader.upload(file, { folder: `content/${userId}` , quality: 'auto'});
  }
}
```

Migration approach (safe): copy-by-reference and dual-write
- When a user uploads, write to new account and keep old media until verification completed
- Run batch job to copy legacy assets to new accounts and patch DB `image_ids`/`video_ids`


SECTION I — Documentation & runbooks (what to produce now)

Add the following under `docs/`:
- `ARCHITECTURE.md` (high-level diagrams and domain separation)
- `schema/TABLES_DETAILED.md` (for every DB table include: purpose, primary keys, important columns, owners, used-by service files)
- `config/env.md` (list of env vars, where they are used and which secrets to rotate)
- `api/oauth.md` (detailed request/response examples)
- `migrations/README.md` (how to run migration scripts)
- `runbooks/` folder: `restore-db.md`, `rotate-secret.md`, `rebuild-indexes.md`, `incident-handling.md`

I will create `docs/schema/TABLES_DETAILED.md` next (auto-generated from the schema provided in the conversation). That will give per-table lines an AI can use. (This is the next todo.)


SECTION J — Immediate runnable snippets & tests

1) Local dev quick-start

```bash
# install
npm ci
# start dev frontend
npm start
# run tests
npm test -- --watchAll=false
```

2) Generate OTP for testing (Node REPL)

```js
// node -e "const otplib=require('otplib');const secret=otplib.authenticator.generateSecret();console.log(secret, otplib.authenticator.generate(secret));"
```

3) Create OAuth client (SQL example) — run in `SUPABASE-IDENTITY`

```sql
INSERT INTO public.oauth_clients (client_id, client_name, client_secret_hash, redirect_uris, owner_id, scopes) VALUES (
  'xv-sample-client', 'Xeevia Sample Client', crypt('super-secret', gen_salt('bf')), ARRAY['https://app.example.com/auth/callback'], '00000000-0000-0000-0000-000000000000', ARRAY['profile','email']
);
```


SECTION K — Handoff checklist for next engineer/AI

1. Read `docs/XEEVIA_MASTER_DOC.md` and `XEEVIA_ARCHITECTURE_STRATEGY.md`
2. Run `npm ci` and `npm start` to confirm UI boots
3. Run SQL sample to insert test `oauth_client`
4. Implement `supabase/functions/oauth-token` with token issuance using `crypto.randomUUID()` as opaque token or JWT
5. Implement `src/services/auth/mfaService.js` functions and wire into `src/components/Account/TwoFactorSetup.jsx`
6. Create `docs/schema/TABLES_DETAILED.md` (I will produce next)

---

Appendix: contact points in repo for quick edits
- Auth flows: `src/services/auth/*`, `src/components/Auth/*`
- Media uploader: `src/components/MediaUploader/*`, `src/services/shared/mediaUrlService.js`
- XRC services: `src/services/xrc/*`
- Wallets and payments: `src/services/wallet/*`, `supabase/functions/*` (webhooks)


End of master doc (generated). Please tell me to proceed with `docs/schema/TABLES_DETAILED.md` generation now or which next item you want prioritized.
