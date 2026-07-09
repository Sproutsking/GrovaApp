# Secret and function ownership map

This document maps the secrets and edge functions you listed to the correct ownership layer for the Xeevia split.

## Principle
- Frontend/browser: only public values
- Server/edge functions: secrets and private keys
- Identity project: auth and identity operations
- Core project: content/community operations
- Wallet project: payments/ledger operations

## Recommended ownership

### 1) Identity project
Use for authentication, OAuth/Xeevia, MFA, sessions, recovery, device trust, and any auth-related edge functions.

#### Secrets
- `IDENTITY_SUPABASE_URL`
- `IDENTITY_SUPABASE_ANON_KEY`
- `IDENTITY_SUPABASE_SERVICE_ROLE_KEY`
- any auth-provider client secrets for Xeevia/OAuth
- any MFA/TOTP/WebAuthn backend secrets

#### Functions
- auth callback handlers
- MFA verification handlers
- recovery-code issuance/verification
- OAuth authorize/token exchange functions
- session refresh or token validation functions

### 2) Core project
Use for posts, feeds, communities, profile content, media metadata, notifications, and content-related workflows.

#### Secrets
- `CORE_SUPABASE_URL`
- `CORE_SUPABASE_ANON_KEY`
- `CORE_SUPABASE_SERVICE_ROLE_KEY`
- media provider credentials that only serve content workflows
- content moderation or notification service secrets if they are not wallet-specific

#### Functions
- content creation/update/delete handlers
- feed generation or recommender hooks
- community membership actions
- notification dispatch functions
- media upload metadata handlers

### 3) Wallet project
Use for all payments, ledgers, treasury, payout, and provider webhook logic.

#### Secrets
- `WALLET_SUPABASE_URL`
- `WALLET_SUPABASE_ANON_KEY`
- `WALLET_SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY` (public; frontend-safe only if needed for client-side flows)
- `OPAY_API_KEY`
- `OPAY_SECRET_KEY`
- `OPAY_MERCHANT_ID`
- `FLUTTERWAVE_SECRET_KEY`
- `TREASURY_WALLET`
- `TREASURY_WALLET_SOL`
- `TREASURY_WALLET_ADA`
- `POLYGON_RPC_URL`
- `BASE_RPC_URL`
- `ARBITRUM_RPC_URL`
- `ETH_RPC_URL`
- `BSC_RPC_URL`
- any provider webhook signing keys

#### Functions
- payment initiation
- payment verification
- wallet balance updates
- ledger reconciliation
- payout and withdrawal handlers
- provider webhook receivers

## Frontend hosting / Vercel
Use for public env values only.

### Frontend-safe values
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_SUPABASE_STREAM_FUNCTION_URL`
- `REACT_APP_PAYSTACK_PUBLIC_KEY`
- `REACT_APP_CLOUDINARY_CLOUD_NAME`
- `REACT_APP_R2_PUBLIC_URL`
- `REACT_APP_VAPID_PUBLIC_KEY`
- `REACT_APP_SW_LOCALHOST`

### Server-only values
- `IDENTITY_SUPABASE_SERVICE_ROLE_KEY`
- `CORE_SUPABASE_SERVICE_ROLE_KEY`
- `WALLET_SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `RESEND_API_KEY`
- `VAPID_PRIVATE_KEY`
- `CLOUDINARY_API_SECRET`
- `LIVEKIT_API_SECRET`
- `ONESIGNAL_REST_API_KEY`
- `OPAY_SECRET_KEY`
- `FLUTTERWAVE_SECRET_KEY`

## Notes on your pasted keys
The items you pasted are clearly split by purpose:
- Email / notification / push / livekit / cloudinary / resend → mostly server-side or provider secrets
- Payment / wallet / RPC / OPay / Flutterwave → wallet-project secrets
- Supabase auth / stream function URL / anon key → identity/core/frontend-safe values depending on use

## Recommended next step
1. Put the frontend-safe values into Vercel project env vars.
2. Put the server-only values into Supabase Edge Function secrets or Vercel server env vars.
3. Keep the three projects isolated by ownership and use a single routing layer for cross-project calls.
