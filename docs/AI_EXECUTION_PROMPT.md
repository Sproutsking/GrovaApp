# 🤖 AI EXECUTION PROMPT - MULTI-SUPABASE SPLIT

**Use this prompt with an AI agent to execute the entire deployment autonomously.**

---

## YOUR MISSION

You are deploying a 1-Supabase → 3-Supabase split for GrovaApp (React PWA + Supabase edge functions).

**DO NOT read any external documents. Everything you need is in this prompt.**

**Objective**: Deploy 43 edge functions across 3 Supabase projects (Identity → Core → Wallet) + migrate 138 database tables. Total execution time: 6-8 hours.

**Success**: All 43 functions deployed, all 138 tables migrated, feature flag enabled.

---

## 🏗️ ARCHITECTURE

### Current State (Delete Later)
```
OLD_SUPABASE (to be decommissioned)
├─ 138 tables (1B+ rows)
├─ 43 edge functions
├─ Payment integrations (Paystack, OPay, Stripe, etc)
└─ Storage buckets (profiles, content, media)
```

### Target State (Build Now)
```
3 SPECIALIZED PROJECTS:

1. IDENTITY (pevhyriszemvnrwvfshm)
   ├─ 7 Edge Functions: generate-2fa, verify-2fa-login, verify-2fa-setup, identity-sync, send-auth-email, generate-deeplink, store-connection-token
   ├─ 35 Tables: profiles, auth_factors, security_events, oauth_tokens, user_preferences, device_fingerprints, ...
   └─ 5 Secrets: IDENTITY_SUPABASE_URL, IDENTITY_SUPABASE_ANON_KEY, IDENTITY_SUPABASE_SERVICE_ROLE_KEY, TWO_FA_ENCRYPTION_KEY, BREVO_API_KEY

2. CORE (hhqohlzzpzgkfdeanudw)
   ├─ 14 Edge Functions: enhance-post, fetch-news, generate-media-url, generate-upload-signature, getCultureContent, publish-platform, relationship-graph, send-push, stream, subscription-sync, activate-free-code, accept-offer, create-offer, proxy-fetch
   ├─ 65 Tables: posts, reels, stories, communities, subscriptions, notifications, messages, content_moderation, ...
   └─ 12 Secrets: CORE_SUPABASE_URL, CORE_SUPABASE_ANON_KEY, CORE_SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, PUSHOVER_API_KEY

3. WALLET (wyqtcjqbdniwebvrwdnk)
   ├─ 23 Edge Functions: deposit-flutterwave-checkout, deposit-opay-checkout, deposit-paystack-init, deposit-paystack-webhook, paystack-create-transaction, paystack-webhook, withdraw-opay, withdraw-paystack-init, withdraw-paystack-webhook, webhook-flutterwave, webhook-opay, webhook-xrc-settlement, listener-web3-settlement, oracle-proof, web3-initiate-payment, web3-payment-status, web3-poll-pending, web3-submit-payment, web3-verify-payment, web3-webhook-listener, stripe-create-session, stripe-webhook, trade-actions
   ├─ 38 Tables: wallets, transactions, payment_methods, settlements, staking_records, savings_accounts, web3_verifications, ...
   └─ 24 Secrets: WALLET_SUPABASE_URL, WALLET_SUPABASE_ANON_KEY, WALLET_SUPABASE_SERVICE_ROLE_KEY, PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY, OPAY_API_KEY, OPAY_SECRET_KEY, OPAY_MERCHANT_ID, FLUTTERWAVE_SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, POLYGON_RPC_URL, BASE_RPC_URL, SOLANA_RPC_URL, ARBITRUM_RPC_URL, ETH_RPC_URL, BSC_RPC_URL, BLOCKFROST_API_KEY, TREASURY_WALLET_EVM, TREASURY_WALLET_SOL, TREASURY_WALLET_ADA, TREASURY_WALLET_TRON, ORACLE_HMAC_KEY, ORACLE_KEY_ID

Frontend sees NO changes. Service layer routes queries to correct Supabase based on domain.
```

---

## 📋 EXACT EXECUTION SEQUENCE

### PHASE 1: IDENTITY PROJECT (15 min) - DO THIS FIRST
```bash
# Step 1: Login to Supabase CLI
cd /workspaces/GrovaApp
supabase login
# ← You will be prompted to authenticate. Use the Supabase account.

# Step 2: Link Identity project
supabase link --project-ref pevhyriszemvnrwvfshm
# ← Confirm linking when prompted

# Step 3: Set 5 Identity secrets
# CRITICAL: Get actual values from Supabase Dashboard → Settings → API
supabase secrets set \
  IDENTITY_SUPABASE_URL="https://pevhyriszemvnrwvfshm.supabase.co" \
  IDENTITY_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBldmh5cmlzemVtdm5yd3Zmc2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDExNDEsImV4cCI6MjA5OTExNzE0MX0.atY-jpLjiGsf7qmF7ycCCptHZjk1oSKeXma630xO3lI" \
  IDENTITY_SUPABASE_SERVICE_ROLE_KEY="<COPY FROM DASHBOARD>" \
  TWO_FA_ENCRYPTION_KEY="<GENERATE 32-BYTE HEX OR GET FROM SECRETS MANAGER>" \
  BREVO_API_KEY="<GET FROM BREVO ACCOUNT>"

# Step 4: Deploy 7 functions one-by-one
supabase functions deploy generate-2fa
supabase functions deploy verify-2fa-login
supabase functions deploy verify-2fa-setup
supabase functions deploy identity-sync
supabase functions deploy send-auth-email
supabase functions deploy generate-deeplink
supabase functions deploy store-connection-token

# Step 5: Verify deployment
supabase functions list
# MUST show exactly 7 functions with status "ACTIVE"

# Step 6: Test one function via curl
curl -X POST https://pevhyriszemvnrwvfshm.supabase.co/functions/v1/generate-2fa \
  -H "Authorization: Bearer $(supabase secrets list | grep IDENTITY_SUPABASE_ANON_KEY | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test"}'
# MUST return HTTP 200 (or 400 with reasonable error, but NOT 500)

# Step 7: Check logs for startup errors
supabase functions list --json | jq
# Look for any "error" status. If found, check logs in Dashboard.
```

**PHASE 1 SUCCESS = 7 functions deployed, all HTTP 200, no startup errors. STOP HERE and verify before moving to Phase 2.**

---

### PHASE 2: CORE PROJECT (32 min) - DO THIS AFTER PHASE 1 VERIFIED
```bash
# Step 1: Logout and login again (different account if multi-account setup)
supabase logout
supabase login

# Step 2: Link Core project (DIFFERENT REF!)
supabase link --project-ref hhqohlzzpzgkfdeanudw
# ← CRITICAL: Do NOT use pevhyriszemvnrwvfshm again. Use hhqohlzzpzgkfdeanudw

# Step 3: Set 12 Core secrets
supabase secrets set \
  CORE_SUPABASE_URL="https://hhqohlzzpzgkfdeanudw.supabase.co" \
  CORE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocW9obHp6cHpna2ZkZWFudWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDI0MTIsImV4cCI6MjA5OTExODQxMn0.MCbHQKLw3_uhg1-IJijo-KnxazyTFpCxgZg9LSLPDic" \
  CORE_SUPABASE_SERVICE_ROLE_KEY="<COPY FROM DASHBOARD>" \
  ANTHROPIC_API_KEY="<GET FROM ANTHROPIC>" \
  ONESIGNAL_APP_ID="<GET FROM ONESIGNAL>" \
  ONESIGNAL_REST_API_KEY="<GET FROM ONESIGNAL>" \
  VAPID_PUBLIC_KEY="<GET FROM WEB PUSH SETUP>" \
  VAPID_PRIVATE_KEY="<GET FROM WEB PUSH SETUP>" \
  LIVEKIT_URL="<GET FROM LIVEKIT>" \
  LIVEKIT_API_KEY="<GET FROM LIVEKIT>" \
  LIVEKIT_API_SECRET="<GET FROM LIVEKIT>" \
  PUSHOVER_API_KEY="<GET FROM PUSHOVER>"

# Step 4: Deploy 14 functions
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

# Step 5: Verify
supabase functions list
# MUST show exactly 14 functions

# Step 6: Test
curl -X GET https://hhqohlzzpzgkfdeanudw.supabase.co/functions/v1/fetch-news \
  -H "Authorization: Bearer $(supabase secrets list | grep CORE_SUPABASE_ANON_KEY | cut -d= -f2)"
# MUST return HTTP 200 (not 500)
```

**PHASE 2 SUCCESS = 14 functions deployed, test HTTP 200. Move to Phase 3.**

---

### PHASE 3: WALLET PROJECT (60 min) - DO THIS AFTER PHASE 2 VERIFIED
```bash
# Step 1: Logout and login
supabase logout
supabase login

# Step 2: Link Wallet project (DIFFERENT REF AGAIN!)
supabase link --project-ref wyqtcjqbdniwebvrwdnk
# ← CRITICAL: Use wyqtcjqbdniwebvrwdnk (NOT the previous 2 refs)

# Step 3: Set 24 Wallet secrets (MOST SECRETS - Payment providers + Web3 RPC)
supabase secrets set \
  WALLET_SUPABASE_URL="https://wyqtcjqbdniwebvrwdnk.supabase.co" \
  WALLET_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5cXRjanFiZG5pd2VidnJ3ZG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDI0NjksImV4cCI6MjA5OTExODQ2OX0.sQaQ4PWTAAe6i-Mknt5EeYycyNoHIpodAUdxU3vfdcs" \
  WALLET_SUPABASE_SERVICE_ROLE_KEY="<COPY FROM DASHBOARD>" \
  PAYSTACK_SECRET_KEY="<GET FROM PAYSTACK DASHBOARD>" \
  PAYSTACK_PUBLIC_KEY="<GET FROM PAYSTACK DASHBOARD>" \
  OPAY_API_KEY="<GET FROM OPAY>" \
  OPAY_SECRET_KEY="<GET FROM OPAY>" \
  OPAY_MERCHANT_ID="<GET FROM OPAY>" \
  FLUTTERWAVE_SECRET_KEY="<GET FROM FLUTTERWAVE>" \
  STRIPE_SECRET_KEY="<GET FROM STRIPE>" \
  STRIPE_WEBHOOK_SECRET="<GET FROM STRIPE>" \
  POLYGON_RPC_URL="<GET FROM ALCHEMY OR INFURA>" \
  BASE_RPC_URL="<GET FROM ALCHEMY OR INFURA>" \
  SOLANA_RPC_URL="<GET FROM QUICKNODE OR HELIUS>" \
  ARBITRUM_RPC_URL="<GET FROM ALCHEMY OR INFURA>" \
  ETH_RPC_URL="<GET FROM ALCHEMY OR INFURA>" \
  BSC_RPC_URL="<GET FROM ALCHEMY OR INFURA>" \
  BLOCKFROST_API_KEY="<GET FROM BLOCKFROST FOR CARDANO>" \
  TREASURY_WALLET_EVM="<YOUR EVM TREASURY ADDRESS 0x...>" \
  TREASURY_WALLET_SOL="<YOUR SOLANA TREASURY ADDRESS>" \
  TREASURY_WALLET_ADA="<YOUR CARDANO TREASURY ADDRESS>" \
  TREASURY_WALLET_TRON="<YOUR TRON TREASURY ADDRESS>" \
  ORACLE_HMAC_KEY="<INTERNAL ORACLE SECRET>" \
  ORACLE_KEY_ID="<INTERNAL ORACLE KEY ID>"

# Step 4: Deploy 23 functions (LONGEST PHASE)
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

# Step 5: Verify
supabase functions list
# MUST show exactly 23 functions

# Step 6: Test
curl -X GET https://wyqtcjqbdniwebvrwdnk.supabase.co/functions/v1/deposit-paystack-init \
  -H "Authorization: Bearer $(supabase secrets list | grep WALLET_SUPABASE_ANON_KEY | cut -d= -f2)"
# MUST return HTTP 200 (not 500)
```

**PHASE 3 SUCCESS = 23 functions deployed, test HTTP 200. Move to data migration.**

---

### PHASE 4: DATA MIGRATION (4-6 hours) - DO THIS AFTER ALL FUNCTIONS DEPLOYED
```bash
# Step 1: Export tables from OLD Supabase (one-time export)
# Use Supabase Dashboard → SQL Editor:
# 1. Click "New Query"
# 2. Paste query to export all schema + data
# 3. Download CSV/JSON for each table

# Identity tables to export (35 tables):
# profiles, auth_factors, security_events, oauth_tokens, user_preferences, 
# device_fingerprints, two_factor_setups, session_locks, ...

# Core tables to export (65 tables):
# posts, reels, stories, communities, subscriptions, notifications, 
# messages, content_moderation, user_followers, feeds, ...

# Wallet tables to export (38 tables):
# wallets, transactions, payment_methods, settlements, staking_records,
# savings_accounts, web3_verifications, ...

# Step 2: Import to new projects
# For each project, use Dashboard SQL Editor:
supabase link --project-ref pevhyriszemvnrwvfshm
# Paste identity_tables.sql in SQL Editor
# Execute

supabase link --project-ref hhqohlzzpzgkfdeanudw
# Paste core_tables.sql in SQL Editor
# Execute

supabase link --project-ref wyqtcjqbdniwebvrwdnk
# Paste wallet_tables.sql in SQL Editor
# Execute

# Step 3: Verify row counts match
# In each new project, query:
SELECT table_name, row_count FROM (
  SELECT table_name, count(*) as row_count FROM information_schema.tables WHERE table_schema='public'
) t;
# Compare with old Supabase. Should match exactly.
```

**PHASE 4 SUCCESS = All 138 tables in 3 projects, row counts match old project.**

---

## ✅ FINAL VERIFICATION

After all 4 phases complete:

```bash
# Verify Phase 1
supabase link --project-ref pevhyriszemvnrwvfshm
supabase functions list | wc -l
# Should output: 7 (minimum)

# Verify Phase 2
supabase link --project-ref hhqohlzzpzgkfdeanudw
supabase functions list | wc -l
# Should output: 14 (minimum)

# Verify Phase 3
supabase link --project-ref wyqtcjqbdniwebvrwdnk
supabase functions list | wc -l
# Should output: 23 (minimum)

# Verify Phase 4 (table counts)
# Query each project and confirm all tables exist
# Total: 35 + 65 + 38 = 138 tables
```

---

## 🎯 SUCCESS CRITERIA (Final Checklist)

- [ ] Phase 1: 7 Identity functions deployed, secrets set, curl test HTTP 200
- [ ] Phase 2: 14 Core functions deployed, secrets set, curl test HTTP 200
- [ ] Phase 3: 23 Wallet functions deployed, 24 secrets set, curl test HTTP 200
- [ ] Phase 4: 138 tables migrated to 3 projects, row counts match
- [ ] All 43 functions show in `supabase functions list` across 3 projects
- [ ] No 500 errors in any test curl command
- [ ] No startup errors in function logs
- [ ] All 43 secrets set correctly (5+12+24)

---

## 🚨 ERROR HANDLING (If Stuck)

### "Function deployment failed"
```bash
# Check what went wrong
supabase functions list --json | jq '.[] | select(.status=="error")'
# Check logs in Supabase Dashboard → Edge Functions → Logs
# Common causes:
#   - Secret missing: Run `supabase secrets list`
#   - Function file doesn't exist: Check `/supabase/functions/<name>/index.ts`
#   - Import error: Review _shared/ dependencies
# Fix: Add secret or fix import, then re-run deploy
```

### "Secret not found when function runs"
```bash
# Verify secret is set
supabase secrets list
# If missing, set it again:
supabase secrets set MY_SECRET="value"
# Re-deploy function:
supabase functions deploy <function-name> --force
```

### "Curl test returns 500"
```bash
# Check function logs
# In Supabase Dashboard: Edge Functions → <function-name> → Logs
# Review error message. Most likely:
#   - Wrong secret key
#   - Database connection failed
#   - Dependency import issue
# Fix: Address root cause and re-deploy
```

### "Rollback to old Supabase"
```bash
# If multi-Supabase fails, revert to single old Supabase:
# In src/services/supabase.js:
# const USE_MULTI_SUPABASE = false;
# Re-deploy frontend
# All traffic goes back to old Supabase (acting as fallback)
```

---

## 📊 TIMELINE

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| 1 | Deploy Identity (7 funcs) | 15 min | Do now |
| 2 | Deploy Core (14 funcs) | 32 min | After Phase 1 ✓ |
| 3 | Deploy Wallet (23 funcs) | 60 min | After Phase 2 ✓ |
| 4 | Migrate data (138 tbl) | 4-6 hr | After Phase 3 ✓ |
| 5 | Verify + test | 30 min | After Phase 4 ✓ |
| **TOTAL** | **All 3 projects live** | **6-8 hrs** | Ready? |

---

## 🚀 START NOW

```bash
cd /workspaces/GrovaApp
supabase login
supabase link --project-ref pevhyriszemvnrwvfshm
# Then follow PHASE 1 above
```

**Execute PHASE 1 (15 min) → PHASE 2 (32 min) → PHASE 3 (60 min) → PHASE 4 (4-6 hrs).**

**No decisions needed. No research needed. Just execute each phase in order.**

**All functions exist. All secrets are documented. All commands are provided.**

---

## 🎯 EXPECTED OUTPUT

When complete:

```
IDENTITY PROJECT (pevhyriszemvnrwvfshm)
✓ 7 functions deployed
✓ 5 secrets set
✓ 35 tables migrated
✓ All tests passing

CORE PROJECT (hhqohlzzpzgkfdeanudw)
✓ 14 functions deployed
✓ 12 secrets set
✓ 65 tables migrated
✓ All tests passing

WALLET PROJECT (wyqtcjqbdniwebvrwdnk)
✓ 23 functions deployed
✓ 24 secrets set
✓ 38 tables migrated
✓ All tests passing

TOTAL:
✓ 43 functions live
✓ 41 secrets configured
✓ 138 tables in 3 projects
✓ Zero downtime migration
✓ Ready for feature flag rollout
```

---

**YOU ARE READY. BEGIN PHASE 1 NOW.**
