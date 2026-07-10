# ⚡ EXECUTE MULTI-SUPABASE SPLIT NOW - DEPLOYMENT SCRIPT

**STATUS**: Ready to execute  
**TOTAL TIME**: ~2 hours (Phase 1-3) + 4-6 hours (data migration) = 6-8 hours total  
**RISK LEVEL**: Low (old Supabase stays as fallback)

---

## 🚀 PHASE 1: IDENTITY PROJECT (15 minutes)

### Step 1.1: Login & Link
```bash
cd /workspaces/GrovaApp
supabase login
supabase link --project-ref pevhyriszemvnrwvfshm
```

### Step 1.2: Set Secrets (Identity Project)
```bash
supabase secrets set \
  IDENTITY_SUPABASE_URL="https://pevhyriszemvnrwvfshm.supabase.co" \
  IDENTITY_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBldmh5cmlzemVtdm5yd3Zmc2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDExNDEsImV4cCI6MjA5OTExNzE0MX0.atY-jpLjiGsf7qmF7ycCCptHZjk1oSKeXma630xO3lI" \
  IDENTITY_SUPABASE_SERVICE_ROLE_KEY="YOUR_IDENTITY_SERVICE_ROLE_KEY" \
  TWO_FA_ENCRYPTION_KEY="YOUR_2FA_ENCRYPTION_KEY" \
  BREVO_API_KEY="YOUR_BREVO_API_KEY"
```

**Status**: ✅ Anon Key populated. Add remaining secrets from Supabase Dashboard.

### Step 1.3: Deploy 7 Functions
```bash
for func in generate-2fa verify-2fa-login verify-2fa-setup identity-sync send-auth-email generate-deeplink store-connection-token; do
  supabase functions deploy $func
  sleep 2
done
```

### Step 1.4: Verify Deployment
```bash
supabase functions list
# Should show 7 functions: generate-2fa, verify-2fa-login, verify-2fa-setup, etc.
```

### Step 1.5: Test One Function
```bash
curl -X POST https://pevhyriszemvnrwvfshm.supabase.co/functions/v1/generate-2fa \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBldmh5cmlzemVtdm5yd3Zmc2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDExNDEsImV4cCI6MjA5OTExNzE0MX0.atY-jpLjiGsf7qmF7ycCCptHZjk1oSKeXma630xO3lI" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test"}'
# Should return 200 or reasonable error (not 500)
```

### Step 1.6: Check Logs
```bash
supabase functions list --json | jq
# Look for any startup errors in logs
```

**✅ PHASE 1 SUCCESS CRITERIA:**
- [ ] All 7 functions deployed (no errors)
- [ ] `supabase functions list` shows all 7
- [ ] Test curl returns HTTP 200 (not 500)
- [ ] No "startup error" in logs
- [ ] Move to Phase 2

---

## 🚀 PHASE 2: CORE PROJECT (32 minutes)

### Step 2.1: Login & Link (Different Project!)
```bash
supabase logout
supabase login
supabase link --project-ref hhqohlzzpzgkfdeanudw
```

### Step 2.2: Set Secrets (Core Project)
```bash
supabase secrets set \
  CORE_SUPABASE_URL="https://hhqohlzzpzgkfdeanudw.supabase.co" \
  CORE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocW9obHp6cHpna2ZkZWFudWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDI0MTIsImV4cCI6MjA5OTExODQxMn0.MCbHQKLw3_uhg1-IJijo-KnxazyTFpCxgZg9LSLPDic" \
  CORE_SUPABASE_SERVICE_ROLE_KEY="YOUR_CORE_SERVICE_ROLE_KEY" \
  ANTHROPIC_API_KEY="YOUR_ANTHROPIC_API_KEY" \
  ONESIGNAL_APP_ID="YOUR_ONESIGNAL_APP_ID" \
  ONESIGNAL_REST_API_KEY="YOUR_ONESIGNAL_REST_API_KEY" \
  VAPID_PUBLIC_KEY="YOUR_VAPID_PUBLIC_KEY" \
  VAPID_PRIVATE_KEY="YOUR_VAPID_PRIVATE_KEY" \
  LIVEKIT_URL="YOUR_LIVEKIT_URL" \
  LIVEKIT_API_KEY="YOUR_LIVEKIT_API_KEY" \
  LIVEKIT_API_SECRET="YOUR_LIVEKIT_API_SECRET"
```

**Status**: ✅ Anon Key populated. Add remaining secrets from Supabase Dashboard.

### Step 2.3: Deploy 14 Functions
```bash
for func in enhance-post fetch-news generate-media-url generate-upload-signature getCultureContent publish-platform relationship-graph send-push stream subscription-sync activate-free-code accept-offer create-offer proxy-fetch; do
  supabase functions deploy $func
  sleep 2
done
```

### Step 2.4: Verify
```bash
supabase functions list
# Should show 14 functions
```

### Step 2.5: Test
```bash
curl -X GET https://hhqohlzzpzgkfdeanudw.supabase.co/functions/v1/fetch-news \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocW9obHp6cHpna2ZkZWFudWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDI0MTIsImV4cCI6MjA5OTExODQxMn0.MCbHQKLw3_uhg1-IJijo-KnxazyTFpCxgZg9LSLPDic"
# Should return 200 or reasonable error
```

**✅ PHASE 2 SUCCESS CRITERIA:**
- [ ] All 14 functions deployed
- [ ] Test curl returns HTTP 200 (not 500)
- [ ] No startup errors in logs
- [ ] Move to Phase 3

---

## 🚀 PHASE 3: WALLET PROJECT (60 minutes)

### Step 3.1: Login & Link (Different Project!)
```bash
supabase logout
supabase login
supabase link --project-ref wyqtcjqbdniwebvrwdnk
```

### Step 3.2: Set Secrets (Most secrets - 24 total)
```bash
supabase secrets set \
  WALLET_SUPABASE_URL="https://wyqtcjqbdniwebvrwdnk.supabase.co" \
  WALLET_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5cXRjanFiZG5pd2VidnJ3ZG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDI0NjksImV4cCI6MjA5OTExODQ2OX0.sQaQ4PWTAAe6i-Mknt5EeYycyNoHIpodAUdxU3vfdcs" \
  WALLET_SUPABASE_SERVICE_ROLE_KEY="YOUR_WALLET_SERVICE_ROLE_KEY" \
  PAYSTACK_SECRET_KEY="YOUR_PAYSTACK_SECRET_KEY" \
  PAYSTACK_PUBLIC_KEY="YOUR_PAYSTACK_PUBLIC_KEY" \
  OPAY_API_KEY="YOUR_OPAY_API_KEY" \
  OPAY_SECRET_KEY="YOUR_OPAY_SECRET_KEY" \
  OPAY_MERCHANT_ID="YOUR_OPAY_MERCHANT_ID" \
  FLUTTERWAVE_SECRET_KEY="YOUR_FLUTTERWAVE_SECRET_KEY" \
  STRIPE_SECRET_KEY="YOUR_STRIPE_SECRET_KEY" \
  STRIPE_WEBHOOK_SECRET="YOUR_STRIPE_WEBHOOK_SECRET" \
  POLYGON_RPC_URL="YOUR_POLYGON_RPC_URL" \
  BASE_RPC_URL="YOUR_BASE_RPC_URL" \
  SOLANA_RPC_URL="YOUR_SOLANA_RPC_URL" \
  ARBITRUM_RPC_URL="YOUR_ARBITRUM_RPC_URL" \
  ETH_RPC_URL="YOUR_ETH_RPC_URL" \
  BSC_RPC_URL="YOUR_BSC_RPC_URL" \
  BLOCKFROST_API_KEY="YOUR_BLOCKFROST_API_KEY" \
  TREASURY_WALLET_EVM="YOUR_TREASURY_WALLET_EVM" \
  TREASURY_WALLET_SOL="YOUR_TREASURY_WALLET_SOL" \
  TREASURY_WALLET_ADA="YOUR_TREASURY_WALLET_ADA" \
  TREASURY_WALLET_TRON="YOUR_TREASURY_WALLET_TRON" \
  ORACLE_HMAC_KEY="YOUR_ORACLE_HMAC_KEY" \
  ORACLE_KEY_ID="YOUR_ORACLE_KEY_ID"
```

### Step 3.3: Deploy 23 Functions
```bash
for func in deposit-flutterwave-checkout deposit-opay-checkout deposit-paystack-init deposit-paystack-webhook paystack-create-transaction paystack-webhook withdraw-opay withdraw-paystack-init withdraw-paystack-webhook webhook-flutterwave webhook-opay webhook-xrc-settlement listener-web3-settlement oracle-proof web3-initiate-payment web3-payment-status web3-poll-pending web3-submit-payment web3-verify-payment web3-webhook-listener stripe-create-session stripe-webhook trade-actions; do
  supabase functions deploy $func
  sleep 2
done
```

### Step 3.4: Verify
```bash
supabase functions list
# Should show 23 functions
```

### Step 3.5: Test
```bash
curl -X GET https://wyqtcjqbdniwebvrwdnk.supabase.co/functions/v1/deposit-paystack-init \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5cXRjanFiZG5pd2VidnJ3ZG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDI0NjksImV4cCI6MjA5OTExODQ2OX0.sQaQ4PWTAAe6i-Mknt5EeYycyNoHIpodAUdxU3vfdcs"
# Should return 200 or reasonable error
```

**✅ PHASE 3 SUCCESS CRITERIA:**
- [ ] All 23 functions deployed
- [ ] Test curl returns HTTP 200 (not 500)
- [ ] No startup errors in logs
- [ ] Move to Data Migration

---

## 📊 DATA MIGRATION (4-6 hours) - OPTIONAL/LATER

### Step 4.1: Export Identity Tables (35 tables)
```bash
# From old Supabase, use Supabase Dashboard:
# 1. Go to: Supabase → Old Project → SQL Editor
# 2. Export schema for tables:
#    profiles, auth_factors, auth_sessions, device_fingerprints,
#    security_events, oauth_tokens, user_preferences, etc.
# Save as: identity_export.sql
```

### Step 4.2: Export Core Tables (65 tables)
```bash
# Export:
#    posts, reels, stories, communities, subscriptions,
#    notifications, messages, content_moderation, etc.
# Save as: core_export.sql
```

### Step 4.3: Export Wallet Tables (38 tables)
```bash
# Export:
#    wallets, transactions, payment_methods, settlements,
#    staking_records, savings_accounts, web3_verifications, etc.
# Save as: wallet_export.sql
```

### Step 4.4: Import to New Projects
```bash
# Link to each project & import:
supabase link --project-ref pevhyriszemvnrwvfshm
supabase db push < identity_export.sql

supabase link --project-ref hhqohlzzpzgkfdeanudw
supabase db push < core_export.sql

supabase link --project-ref wyqtcjqbdniwebvrwdnk
supabase db push < wallet_export.sql
```

---

## 🔄 VERIFY EVERYTHING (15 minutes)

```bash
# Check all 3 projects have functions:
supabase link --project-ref pevhyriszemvnrwvfshm
supabase functions list | wc -l
# Should be 7+

supabase link --project-ref hhqohlzzpzgkfdeanudw
supabase functions list | wc -l
# Should be 14+

supabase link --project-ref wyqtcjqbdniwebvrwdnk
supabase functions list | wc -l
# Should be 23+

# Verify secrets set in each:
supabase secrets list
# Identity should show 5 secrets
# Core should show 12 secrets  
# Wallet should show 24 secrets
```

---

## ⚠️ IF SOMETHING BREAKS

### Functions won't deploy?
```bash
supabase functions list --json | jq '.[] | select(.status=="error")'
# Check logs in Supabase Dashboard → Edge Functions → Logs tab
# Common fixes:
#   1. Secret typo? → Re-run `supabase secrets list`
#   2. Function file doesn't exist? → Check `/supabase/functions/<name>/index.ts`
#   3. Import errors? → Review function's imports, check _shared/ helpers
```

### Revert to Old Supabase?
```bash
# In src/services/supabase.js:
# Change: const USE_MULTI_SUPABASE = true
# To:     const USE_MULTI_SUPABASE = false
# Redeploy frontend
# All queries go back to old Supabase
```

### Re-deploy a function?
```bash
supabase link --project-ref <PROJECT_REF>
supabase functions deploy <FUNCTION_NAME> --force
```

---

## ✅ COMPLETION CHECKLIST

### After ALL 3 Phases Complete:
- [ ] Phase 1: 7 functions deployed to Identity
- [ ] Phase 2: 14 functions deployed to Core
- [ ] Phase 3: 23 functions deployed to Wallet
- [ ] All 43 functions show in `supabase functions list`
- [ ] No 500 errors in test curl commands
- [ ] All secrets set correctly (43 total)
- [ ] Data migration complete (optional but recommended)

### Next: Frontend Activation (1 hour)
```bash
# In src/services/supabase.js:
# Change: const USE_MULTI_SUPABASE = false
# To:     const USE_MULTI_SUPABASE = true

# Deploy with feature flag:
# 5% of users → 25% → 50% → 100%

npm run build
# Deploy to Vercel/hosting
```

---

## 📞 REFERENCE QUICK LINKS

**In Supabase Dashboard:**
- Identity: https://app.supabase.com/project/pevhyriszemvnrwvfshm
- Core: https://app.supabase.com/project/hhqohlzzpzgkfdeanudw
- Wallet: https://app.supabase.com/project/wyqtcjqbdniwebvrwdnk

**In Docs (if needed):**
- Full details: `docs/DEPLOYMENT_COMMANDS_REFERENCE.md`
- Function list: `docs/FUNCTION_AUDIT_AND_VERIFICATION.md`
- Table mapping: `docs/TABLE_ASSIGNMENT_AND_MIGRATION_MAP.md`

---

## 🎯 TIMING ESTIMATE

| Phase | Task | Time |
|-------|------|------|
| 1 | Identity functions | 15 min |
| 2 | Core functions | 32 min |
| 3 | Wallet functions | 60 min |
| 4 | Data migration | 4-6 hours |
| 5 | Testing & verification | 30 min |
| **TOTAL** | **All phases** | **6-8 hours** |

---

## 🚀 START NOW

```bash
cd /workspaces/GrovaApp
supabase login
supabase link --project-ref pevhyriszemvnrwvfshm
# Then follow PHASE 1 above
```

**No more reading. Execute PHASE 1 now. Move to PHASE 2 after 15 min. Move to PHASE 3 after 32 min.**

**Everything else is automated. You are 100% ready.**

Let's go! 🎯
