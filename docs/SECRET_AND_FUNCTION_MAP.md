# Supabase function and secret ownership map

This document reflects the edge functions currently present in the Supabase folder and assigns them to the Xeevia split: Identity, Core, and Wallet.

## Core rule
- Frontend/browser: only public values.
- Supabase Edge Functions: private values and provider secrets.
- Do not keep service-role keys, payment secrets, or webhook secrets in one shared bucket if they are project-specific.
- The current code still uses generic names such as SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in several functions. For the split, the deployment layer should set these per project or expose project-specific aliases such as IDENTITY_SUPABASE_URL / CORE_SUPABASE_URL / WALLET_SUPABASE_URL.

## 1) Xeevia Identity project
Use this project for authentication, MFA, account recovery, identity sync, and any user-auth flows.

### Functions to deploy here
- generate-2fa
- verify-2fa-login
- verify-2fa-setup
- identity-sync
- send-auth-email
- generate-deeplink

### Secrets to keep here
- IDENTITY_SUPABASE_URL
- IDENTITY_SUPABASE_ANON_KEY
- IDENTITY_SUPABASE_SERVICE_ROLE_KEY
- TWO_FA_ENCRYPTION_KEY
- BREVO_API_KEY

### Notes
- If the auth email flow later uses a dedicated provider, keep that provider secret in this project only.
- Keep any identity-only OAuth or device-trust secret here as well.

## 2) Xeevia Core project
Use this project for content, feed, community, media, notifications, subscriptions, and other app-core experiences.

### Functions to deploy here
- enhance-post
- fetch-news
- generate-media-url
- generate-upload-signature
- getCultureContent
- publish-platform
- relationship-graph
- send-push
- stream
- subscription-sync
- activate-free-code
- accept-offer
- create-offer
- proxy-fetch

### Secrets to keep here
- CORE_SUPABASE_URL
- CORE_SUPABASE_ANON_KEY
- CORE_SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- ONESIGNAL_APP_ID
- ONESIGNAL_REST_API_KEY
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- LIVEKIT_URL
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET

### Notes
- Notifications, media, live streaming, and content moderation logic belong here.
- If a marketplace or offer feature later grows into a separate product domain, it can be split out later, but for now it fits best in Core.

## 3) Xeevia Wallet project
Use this project for payments, payouts, wallets, webhooks, settlement, and on-chain verification.

### Functions to deploy here
- deposit-flutterwave-checkout
- deposit-opay-checkout
- deposit-paystack-init
- deposit-paystack-webhook
- paystack-create-transaction
- paystack-webhook
- withdraw-opay
- withdraw-paystack-init
- withdraw-paystack-webhook
- webhook-flutterwave
- webhook-opay
- webhook-xrc-settlement
- listener-web3-settlement
- oracle-proof
- web3-initiate-payment
- web3-payment-status
- web3-poll-pending
- web3-submit-payment
- web3-verify-payment
- web3-webhook-listener
- stripe-create-session
- stripe-webhook
- trade-actions

### Secrets to keep here
- WALLET_SUPABASE_URL
- WALLET_SUPABASE_ANON_KEY
- WALLET_SUPABASE_SERVICE_ROLE_KEY
- PAYSTACK_SECRET_KEY
- PAYSTACK_PUBLIC_KEY
- OPAY_API_KEY
- OPAY_SECRET_KEY
- OPAY_MERCHANT_ID
- FLUTTERWAVE_SECRET_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- POLYGON_RPC_URL
- BASE_RPC_URL
- SOLANA_RPC_URL
- ARBITRUM_RPC_URL
- ETH_RPC_URL
- BSC_RPC_URL
- BLOCKFROST_API_KEY
- TREASURY_WALLET_EVM
- TREASURY_WALLET_SOL
- TREASURY_WALLET_ADA
- TREASURY_WALLET_TRON
- ORACLE_HMAC_KEY
- ORACLE_KEY_ID

### Notes
- This is the correct home for all payment-provider and webhook secrets.
- RPC URLs and treasury addresses should not be shared with Identity or Core.

## Frontend-safe values
Keep these in the app hosting layer only, not in the edge-function secret store.

- REACT_APP_SUPABASE_URL
- REACT_APP_SUPABASE_ANON_KEY
- REACT_APP_SUPABASE_STREAM_FUNCTION_URL
- REACT_APP_PAYSTACK_PUBLIC_KEY
- REACT_APP_CLOUDINARY_CLOUD_NAME
- REACT_APP_R2_PUBLIC_URL
- REACT_APP_VAPID_PUBLIC_KEY
- REACT_APP_SW_LOCALHOST

## Recommended deployment structure
1. Deploy Identity functions to the Identity project only.
2. Deploy Core functions to the Core project only.
3. Deploy Wallet functions to the Wallet project only.
4. Keep provider secrets and project-specific service-role keys isolated per project.
5. Use the shared hosting layer only for public values.

## Practical decision on the long secret list
The split above is the recommended structure. The only values that should remain shared are public frontend values. Everything private, provider-facing, or project-scoped should be assigned to one of the three projects above.
