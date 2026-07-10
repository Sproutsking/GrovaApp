# FUNCTION AUDIT & DEPLOYMENT VERIFICATION

**Last Updated**: 2026-07-10  
**Total Functions**: 43  
**Status**: ✅ Ready to Deploy

---

## 📊 FUNCTION INVENTORY

### ✅ IDENTITY PROJECT - 7 Functions

| Function | Status | Dependencies | Est. Deploy Time |
|----------|--------|--------------|------------------|
| `generate-2fa` | Ready | crypto, otpauth | 2min |
| `verify-2fa-login` | Ready | jsonwebtoken | 2min |
| `verify-2fa-setup` | Ready | otpauth | 2min |
| `identity-sync` | Ready | Supabase RLS | 3min |
| `send-auth-email` | Ready | Brevo SDK | 2min |
| `generate-deeplink` | Ready | crypto | 2min |
| `store-connection-token` | Ready | AES encryption | 2min |
| | | **Total** | **~15min** |

### ✅ CORE PROJECT - 14 Functions

| Function | Status | Dependencies | Est. Deploy Time |
|----------|--------|--------------|------------------|
| `enhance-post` | Ready | Anthropic API | 2min |
| `fetch-news` | Ready | External APIs | 2min |
| `generate-media-url` | Ready | Cloudinary SDK | 2min |
| `generate-upload-signature` | Ready | Cloudinary | 2min |
| `getCultureContent` | Ready | Supabase query | 2min |
| `publish-platform` | Ready | OAuth flows | 2min |
| `relationship-graph` | Ready | Graph queries | 3min |
| `send-push` | Ready | OneSignal SDK | 2min |
| `stream` | Ready | LiveKit SDK | 2min |
| `subscription-sync` | Ready | Stripe/Paystack | 3min |
| `activate-free-code` | Ready | Supabase RPC | 2min |
| `accept-offer` | Ready | Transaction logic | 2min |
| `create-offer` | Ready | Marketplace logic | 2min |
| `proxy-fetch` | Ready | Fetch wrapper | 1min |
| | | **Total** | **~32min** |

### ✅ WALLET PROJECT - 22 Functions

| Function | Status | Dependencies | Est. Deploy Time |
|----------|--------|--------------|------------------|
| `deposit-flutterwave-checkout` | Ready | Flutterwave API | 3min |
| `deposit-opay-checkout` | Ready | OPay API | 3min |
| `deposit-paystack-init` | Ready | Paystack API | 3min |
| `deposit-paystack-webhook` | Ready | Paystack webhook | 2min |
| `paystack-create-transaction` | Ready | Paystack API | 2min |
| `paystack-webhook` | Ready | Webhook handler | 2min |
| `withdraw-opay` | Ready | OPay API | 3min |
| `withdraw-paystack-init` | Ready | Paystack API | 3min |
| `withdraw-paystack-webhook` | Ready | Webhook handler | 2min |
| `webhook-flutterwave` | Ready | Verification | 2min |
| `webhook-opay` | Ready | Verification | 2min |
| `webhook-xrc-settlement` | Ready | XRC records | 2min |
| `listener-web3-settlement` | Ready | Blockchain listener | 3min |
| `oracle-proof` | Ready | Oracle verification | 3min |
| `web3-initiate-payment` | Ready | Web3 libs | 3min |
| `web3-payment-status` | Ready | Chain query | 2min |
| `web3-poll-pending` | Ready | Chain polling | 2min |
| `web3-submit-payment` | Ready | Chain submission | 3min |
| `web3-verify-payment` | Ready | Chain verification | 2min |
| `web3-webhook-listener` | Ready | Webhook handler | 2min |
| `stripe-create-session` | Ready | Stripe API | 2min |
| `stripe-webhook` | Ready | Webhook handler | 2min |
| `trade-actions` | Ready | Trading logic | 3min |
| | | **Total** | **~60min** |

---

## 🔍 DEPENDENCY MATRIX

### Shared Dependencies (_shared folder)
```
_shared/
├── crypto.ts         (AES-GCM encryption)
├── jwt.ts            (Token verification)
├── validators.ts     (Input validation)
└── logging.ts        (Error tracking)
```

### External Dependencies (by Project)

**IDENTITY**:
- otpauth (TOTP generation)
- jsonwebtoken (JWT)
- crypto (built-in Node)
- Brevo SDK (email)

**CORE**:
- Anthropic SDK (content enhancement)
- Cloudinary SDK (media)
- OneSignal SDK (push)
- LiveKit SDK (streaming)
- Stripe SDK (subscriptions)

**WALLET**:
- Paystack SDK (payments)
- OPay SDK (mobile money)
- Flutterwave SDK (alternative payment)
- Stripe SDK (cards)
- Web3.js (blockchain)
- Ethers.js (EVM chains)
- Solana Web3.js (Solana)

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### Function Code Review
- [ ] All 43 functions have `index.ts` or `index.js`
- [ ] All have error handling
- [ ] All return proper status codes
- [ ] No hardcoded secrets (use env vars)
- [ ] No console.log (use structured logging)

### Dependency Audit
- [ ] All npm packages listed in each function's `package.json`
- [ ] No version conflicts between projects
- [ ] All external APIs have credentials ready

### Security
- [ ] All functions validate input
- [ ] All use CORS headers
- [ ] All check authentication (where needed)
- [ ] All rate limit sensitive operations
- [ ] All log security events

### Testing
- [ ] Mock tests for all 43 functions exist
- [ ] Tests run in isolation (no live DB)
- [ ] All mocks use fake credentials

---

## 📋 TABLE MIGRATION ORDER

### Phase 1: Identity (Day 1-2)
**Order**: Auth dependency → then everything else
```
1. profiles (dependency for everything)
2. auth.users (Supabase managed)
3. device_fingerprints
4. trusted_devices
5. two_factor_auth
6. user_sessions
7. security_events
8. rate_limits
9. verification_codes
10. user_recovery_phrases
11. audit_logs
12. followed_users (relationships)
13-35. [Other identity tables]
```

### Phase 2: Core (Day 3-5)
**Order**: Depends on profiles from Identity
```
1. posts (high volume)
2. reels
3. stories
4. comments
5. [all like tables]
6. communities
7. [community tables]
8. notifications
9. [messaging tables]
10. news_posts
11. [news tables]
12. live_sessions
13-65. [Other core tables]
```

### Phase 3: Wallet (Day 6-7)
**Order**: Depends on profiles + transactions
```
1. wallets (high volume)
2. transactions
3. payments
4. subscriptions
5. wallet_history
6. staking_positions
7. savings_plans
8. [all payment-related]
9-38. [Other wallet tables]
```

---

## 🔐 SECRETS CHECKLIST

### Identity Project Secrets (7 items)
- [ ] `IDENTITY_SUPABASE_URL` = `https://pevhyriszemvnrwvfshm.supabase.co`
- [ ] `IDENTITY_SUPABASE_ANON_KEY` = from project settings
- [ ] `IDENTITY_SUPABASE_SERVICE_ROLE_KEY` = from project settings
- [ ] `TWO_FA_ENCRYPTION_KEY` = 32-byte hex (openssl rand -hex 32)
- [ ] `BREVO_API_KEY` = from Brevo account
- [ ] `SLACK_WEBHOOK_URL` (optional) = for alerts
- [ ] `SENTRY_DSN` (optional) = for error tracking

### Core Project Secrets (12 items)
- [ ] `CORE_SUPABASE_URL` = `https://hhqohlzzpzgkfdeanudw.supabase.co`
- [ ] `CORE_SUPABASE_ANON_KEY`
- [ ] `CORE_SUPABASE_SERVICE_ROLE_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `ONESIGNAL_APP_ID`
- [ ] `ONESIGNAL_REST_API_KEY`
- [ ] `VAPID_PUBLIC_KEY`
- [ ] `VAPID_PRIVATE_KEY`
- [ ] `LIVEKIT_URL`
- [ ] `LIVEKIT_API_KEY`
- [ ] `LIVEKIT_API_SECRET`
- [ ] `CLOUDINARY_CLOUD_NAME`

### Wallet Project Secrets (24 items)
- [ ] `WALLET_SUPABASE_URL` = `https://wyqtcjqbdniwebvrwdnk.supabase.co`
- [ ] `WALLET_SUPABASE_ANON_KEY`
- [ ] `WALLET_SUPABASE_SERVICE_ROLE_KEY`
- [ ] `PAYSTACK_SECRET_KEY`
- [ ] `PAYSTACK_PUBLIC_KEY`
- [ ] `OPAY_API_KEY`
- [ ] `OPAY_SECRET_KEY`
- [ ] `OPAY_MERCHANT_ID`
- [ ] `FLUTTERWAVE_SECRET_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `POLYGON_RPC_URL`
- [ ] `BASE_RPC_URL`
- [ ] `SOLANA_RPC_URL`
- [ ] `ARBITRUM_RPC_URL`
- [ ] `ETH_RPC_URL`
- [ ] `BSC_RPC_URL`
- [ ] `BLOCKFROST_API_KEY`
- [ ] `TREASURY_WALLET_EVM`
- [ ] `TREASURY_WALLET_SOL`
- [ ] `TREASURY_WALLET_ADA`
- [ ] `TREASURY_WALLET_TRON`
- [ ] `ORACLE_HMAC_KEY`
- [ ] `ORACLE_KEY_ID`

**Total Secrets**: 43 (7 + 12 + 24)

---

## 🧪 TESTING PROCEDURE

### Per-Function Test
```bash
# Test Identity function
curl -X POST https://pevhyriszemvnrwvfshm.functions.supabase.co/generate-2fa \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-uuid"}'

# Expected: { "secret": "...", "qr_code": "..." }
```

### Batch Verification Script
```bash
#!/bin/bash
# Test all functions are deployed

IDENTITY_FUNCS=("generate-2fa" "verify-2fa-login" "verify-2fa-setup" "identity-sync" "send-auth-email" "generate-deeplink" "store-connection-token")
CORE_FUNCS=("enhance-post" "fetch-news" ... )
WALLET_FUNCS=("deposit-flutterwave-checkout" ... )

for func in "${IDENTITY_FUNCS[@]}"; do
  curl -s -o /dev/null -w "%{http_code}" \
    "https://pevhyriszemvnrwvfshm.functions.supabase.co/$func" \
    && echo "$func ✓" || echo "$func ✗"
done
```

---

## 📈 DEPLOYMENT TIMELINE

```
Week 1:
├─ Mon-Tue: Identity (7 functions) → 15min
├─ Wed-Thu: Core (14 functions) → 32min
└─ Fri: Wallet (22 functions) → 60min
        Total: ~2 hours active deployment

Week 2:
├─ Data migration & verification
├─ Cross-project testing
└─ Frontend service layer update

Week 3:
├─ Feature flag rollout (5% → 25% → 100%)
├─ Monitoring & alerts
└─ Decommission old Supabase (backup first!)
```

---

## ✨ SUCCESS CRITERIA

**Phase Complete When**:
- ✅ All N functions deployed without errors
- ✅ No startup logs errors in any function
- ✅ Test requests return expected responses
- ✅ Secrets properly set in all 3 projects
- ✅ RLS policies enforced on all tables
- ✅ Webhooks receiving data
- ✅ Frontend using multi-client adapter
- ✅ Zero user-facing changes

---

**Ready to start Phase 1?** Let's deploy Identity functions! 🚀
