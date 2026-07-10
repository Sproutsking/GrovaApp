# Supabase deployment runbook for the three projects

This runbook gives the recommended one-project-at-a-time deployment sequence for the Xeevia split.

## Deployment order
1. Identity project
2. Core project
3. Wallet project

## Project ownership
- Identity: auth, MFA, account recovery, identity sync
- Core: content, media, notifications, subscriptions, feed/community experiences
- Wallet: payments, payouts, webhooks, settlement, blockchain verification

## One-project-at-a-time flow
For each project:
1. Log in to the correct Supabase account.
2. Link the correct project ref.
3. Set only that project’s secrets.
4. Deploy only that project’s functions.
5. Verify the deployment and logs.

## Required tools
- Supabase CLI
- jq or a similar verifier

## Identity project
```bash
supabase login
supabase link --project-ref <IDENTITY_PROJECT_REF>
supabase secrets set \
  IDENTITY_SUPABASE_URL=... \
  IDENTITY_SUPABASE_ANON_KEY=... \
  IDENTITY_SUPABASE_SERVICE_ROLE_KEY=... \
  TWO_FA_ENCRYPTION_KEY=... \
  BREVO_API_KEY=...

supabase functions deploy generate-2fa
supabase functions deploy verify-2fa-login
supabase functions deploy verify-2fa-setup
supabase functions deploy identity-sync
supabase functions deploy send-auth-email
supabase functions deploy generate-deeplink
```

## Core project
```bash
supabase login
supabase link --project-ref <CORE_PROJECT_REF>
supabase secrets set \
  CORE_SUPABASE_URL=... \
  CORE_SUPABASE_ANON_KEY=... \
  CORE_SUPABASE_SERVICE_ROLE_KEY=... \
  ANTHROPIC_API_KEY=... \
  ONESIGNAL_APP_ID=... \
  ONESIGNAL_REST_API_KEY=... \
  VAPID_PUBLIC_KEY=... \
  VAPID_PRIVATE_KEY=... \
  LIVEKIT_URL=... \
  LIVEKIT_API_KEY=... \
  LIVEKIT_API_SECRET=...

supabase functions deploy enhance-post
supabase functions deploy fetch-news
supabase functions deploy generate-media-url
supabase functions deploy generate-upload-signature
supabase functions deploy getCultureContent
supabase functions deploy publish-platform
supabase functions deploy relationship-graph
supabase functions deploy send-push
supabase functions deploy stream
supabase functions deploy subscription-sync
supabase functions deploy activate-free-code
supabase functions deploy accept-offer
supabase functions deploy create-offer
supabase functions deploy proxy-fetch
```

## Wallet project
```bash
supabase login
supabase link --project-ref <WALLET_PROJECT_REF>
supabase secrets set \
  WALLET_SUPABASE_URL=... \
  WALLET_SUPABASE_ANON_KEY=... \
  WALLET_SUPABASE_SERVICE_ROLE_KEY=... \
  PAYSTACK_SECRET_KEY=... \
  PAYSTACK_PUBLIC_KEY=... \
  OPAY_API_KEY=... \
  OPAY_SECRET_KEY=... \
  OPAY_MERCHANT_ID=... \
  FLUTTERWAVE_SECRET_KEY=... \
  STRIPE_SECRET_KEY=... \
  STRIPE_WEBHOOK_SECRET=... \
  POLYGON_RPC_URL=... \
  BASE_RPC_URL=... \
  SOLANA_RPC_URL=... \
  ARBITRUM_RPC_URL=... \
  ETH_RPC_URL=... \
  BSC_RPC_URL=... \
  BLOCKFROST_API_KEY=... \
  TREASURY_WALLET_EVM=... \
  TREASURY_WALLET_SOL=... \
  TREASURY_WALLET_ADA=... \
  TREASURY_WALLET_TRON=... \
  ORACLE_HMAC_KEY=... \
  ORACLE_KEY_ID=...

supabase functions deploy deposit-flutterwave-checkout
supabase functions deploy deposit-opay-checkout
supabase functions deploy deposit-paystack-init
supabase functions deploy deposit-paystack-webhook
supabase functions deploy paystack-create-transaction
supabase functions deploy paystack-webhook
supabase functions deploy withdraw-opay
supabase functions deploy withdraw-paystack-init
supabase functions deploy withdraw-paystack-webhook
supabase functions deploy webhook-flutterwave
supabase functions deploy webhook-opay
supabase functions deploy webhook-xrc-settlement
supabase functions deploy listener-web3-settlement
supabase functions deploy oracle-proof
supabase functions deploy web3-initiate-payment
supabase functions deploy web3-payment-status
supabase functions deploy web3-poll-pending
supabase functions deploy web3-submit-payment
supabase functions deploy web3-verify-payment
supabase functions deploy web3-webhook-listener
supabase functions deploy stripe-create-session
supabase functions deploy stripe-webhook
supabase functions deploy trade-actions
```

## Verification checklist
- The function deployed successfully.
- The expected secrets are present in that project.
- The function logs show no startup errors.
- A test request returns success.

## Important note
Do not deploy the full function set to every project. Deploy only the ownership group listed above.
