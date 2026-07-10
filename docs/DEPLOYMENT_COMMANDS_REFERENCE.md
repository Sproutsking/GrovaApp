# 🚀 DEPLOYMENT COMMANDS REFERENCE

**Quick Copy-Paste Guide for Multi-Supabase Deployment**

---

## 📋 BEFORE YOU START

```bash
# 1. Install Supabase CLI (if not already)
npm install -g supabase

# 2. Have these ready:
# - Identity Project Ref: pevhyriszemvnrwvfshm
# - Core Project Ref: hhqohlzzpzgkfdeanudw
# - Wallet Project Ref: wyqtcjqbdniwebvrwdnk
# - All API keys (see FUNCTION_AUDIT_AND_VERIFICATION.md)

# 3. Clone secrets to a secure .env.deployment file
# NEVER commit this file
```

---

## 🔐 PHASE 1: IDENTITY PROJECT DEPLOYMENT

### Step 1.1: Login & Link
```bash
# Clear any previous links
rm -rf ~/.supabase/

# Login to Supabase
supabase login

# Link to Identity project
supabase link --project-ref pevhyriszemvnrwvfshm
```

### Step 1.2: Set Secrets
```bash
# Set one at a time or in bulk - save to .env.deployment first
supabase secrets set \
  IDENTITY_SUPABASE_URL="https://pevhyriszemvnrwvfshm.supabase.co" \
  IDENTITY_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  IDENTITY_SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  TWO_FA_ENCRYPTION_KEY="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  BREVO_API_KEY="xkeysib-..."
```

### Step 1.3: Deploy 7 Functions
```bash
cd /workspaces/GrovaApp

# Deploy each function (takes ~2-3 minutes total)
supabase functions deploy generate-2fa
supabase functions deploy verify-2fa-login
supabase functions deploy verify-2fa-setup
supabase functions deploy identity-sync
supabase functions deploy send-auth-email
supabase functions deploy generate-deeplink
supabase functions deploy store-connection-token

# Verify all 7 deployed
supabase functions list --project-ref pevhyriszemvnrwvfshm
```

### Step 1.4: Test Endpoints
```bash
# Test that functions are live (should return 200 or function-specific response)
curl -X POST https://pevhyriszemvnrwvfshm.functions.supabase.co/generate-2fa \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-uuid-123"}'

curl -X GET https://pevhyriszemvnrwvfshm.functions.supabase.co/identity-sync
```

### Step 1.5: Check Logs
```bash
# View function logs for any errors
supabase functions list --project-ref pevhyriszemvnrwvfshm

# In Supabase dashboard: Functions → select each → Logs tab
```

---

## 📱 PHASE 2: CORE PROJECT DEPLOYMENT

### Step 2.1: Unlink & Switch Project
```bash
# Unlink from Identity
supabase unlink

# Link to Core project
supabase link --project-ref hhqohlzzpzgkfdeanudw
```

### Step 2.2: Set Core Secrets
```bash
supabase secrets set \
  CORE_SUPABASE_URL="https://hhqohlzzpzgkfdeanudw.supabase.co" \
  CORE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  CORE_SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  ANTHROPIC_API_KEY="sk-ant-..." \
  ONESIGNAL_APP_ID="..." \
  ONESIGNAL_REST_API_KEY="..." \
  VAPID_PUBLIC_KEY="..." \
  VAPID_PRIVATE_KEY="..." \
  LIVEKIT_URL="wss://..." \
  LIVEKIT_API_KEY="..." \
  LIVEKIT_API_SECRET="..." \
  CLOUDINARY_CLOUD_NAME="xeevia-content"
```

### Step 2.3: Deploy 14 Functions
```bash
cd /workspaces/GrovaApp

# Deploy all Core functions
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

# Verify all 14 deployed
supabase functions list --project-ref hhqohlzzpzgkfdeanudw
```

### Step 2.4: Test Key Functions
```bash
# Test media URL generation
curl -X POST https://hhqohlzzpzgkfdeanudw.functions.supabase.co/generate-media-url \
  -H "Content-Type: application/json" \
  -d '{"image_id":"test-image"}'

# Test push notification
curl -X POST https://hhqohlzzpzgkfdeanudw.functions.supabase.co/send-push \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-uuid"}'
```

---

## 💳 PHASE 3: WALLET PROJECT DEPLOYMENT

### Step 3.1: Unlink & Switch Project
```bash
# Unlink from Core
supabase unlink

# Link to Wallet project
supabase link --project-ref wyqtcjqbdniwebvrwdnk
```

### Step 3.2: Set Wallet Secrets (24 secrets!)
```bash
# Payment Provider Secrets
supabase secrets set \
  WALLET_SUPABASE_URL="https://wyqtcjqbdniwebvrwdnk.supabase.co" \
  WALLET_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  WALLET_SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Paystack
supabase secrets set \
  PAYSTACK_SECRET_KEY="sk_live_..." \
  PAYSTACK_PUBLIC_KEY="pk_live_..."

# OPay
supabase secrets set \
  OPAY_API_KEY="..." \
  OPAY_SECRET_KEY="..." \
  OPAY_MERCHANT_ID="..."

# Flutterwave
supabase secrets set FLUTTERWAVE_SECRET_KEY="FLWSECK_TEST-..."

# Stripe
supabase secrets set \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..."

# Web3 RPC URLs
supabase secrets set \
  POLYGON_RPC_URL="https://polygon-rpc.com" \
  BASE_RPC_URL="https://mainnet.base.org" \
  SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" \
  ARBITRUM_RPC_URL="https://arb1.arbitrum.io/rpc" \
  ETH_RPC_URL="https://eth.llamarpc.com" \
  BSC_RPC_URL="https://bsc-dataseed1.binance.org"

# Blockchain API Keys
supabase secrets set BLOCKFROST_API_KEY="mainnetABC123..."

# Treasury Wallets
supabase secrets set \
  TREASURY_WALLET_EVM="0x..." \
  TREASURY_WALLET_SOL="..." \
  TREASURY_WALLET_ADA="addr1..." \
  TREASURY_WALLET_TRON="T..."

# Oracle
supabase secrets set \
  ORACLE_HMAC_KEY="..." \
  ORACLE_KEY_ID="..."
```

### Step 3.3: Deploy 23 Functions
```bash
cd /workspaces/GrovaApp

# Deposit Functions
supabase functions deploy deposit-flutterwave-checkout
supabase functions deploy deposit-opay-checkout
supabase functions deploy deposit-paystack-init
supabase functions deploy deposit-paystack-webhook
supabase functions deploy paystack-create-transaction
supabase functions deploy paystack-webhook

# Withdrawal Functions
supabase functions deploy withdraw-opay
supabase functions deploy withdraw-paystack-init
supabase functions deploy withdraw-paystack-webhook

# Webhook Handlers
supabase functions deploy webhook-flutterwave
supabase functions deploy webhook-opay
supabase functions deploy webhook-xrc-settlement

# Web3 Functions
supabase functions deploy listener-web3-settlement
supabase functions deploy oracle-proof
supabase functions deploy web3-initiate-payment
supabase functions deploy web3-payment-status
supabase functions deploy web3-poll-pending
supabase functions deploy web3-submit-payment
supabase functions deploy web3-verify-payment
supabase functions deploy web3-webhook-listener

# Stripe & Advanced
supabase functions deploy stripe-create-session
supabase functions deploy stripe-webhook
supabase functions deploy trade-actions

# Verify all 23 deployed
supabase functions list --project-ref wyqtcjqbdniwebvrwdnk
```

### Step 3.4: Test Payment Flows
```bash
# Test Paystack deposit init
curl -X POST https://wyqtcjqbdniwebvrwdnk.functions.supabase.co/deposit-paystack-init \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-uuid","amount":5000}'

# Test OPay withdrawal
curl -X POST https://wyqtcjqbdniwebvrwdnk.functions.supabase.co/withdraw-opay \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-uuid","phone":"234908..."}'

# Test Web3 payment status
curl -X GET https://wyqtcjqbdniwebvrwdnk.functions.supabase.co/web3-payment-status?tx_hash=0x...
```

---

## 🗄️ MIGRATION SCRIPTS

After all 3 projects deployed, run migrations:

### Identity Database Tables
```bash
# Run in Supabase Identity SQL Editor:
# File: docs/schema/identity_tables.sql (CREATE TABLE statements)

-- Apply constraints and indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_device_fingerprints_user ON device_fingerprints(user_id);
CREATE INDEX idx_two_factor_auth_user ON two_factor_auth(user_id);
CREATE INDEX idx_security_events_user ON security_events(user_id, created_at);
CREATE INDEX idx_rate_limits_user_action ON rate_limits(user_id, action_type);
```

### Core Database Tables
```bash
# Run in Supabase Core SQL Editor:
# File: docs/schema/core_tables.sql (CREATE TABLE statements)

-- Apply constraints and indexes for high-volume tables
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at);
CREATE INDEX idx_posts_category ON posts(category);
CREATE INDEX idx_comments_post_created ON comments(post_id, created_at);
CREATE INDEX idx_reels_user_created ON reels(user_id, created_at);
CREATE INDEX idx_communities_owner ON communities(owner_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
```

### Wallet Database Tables
```bash
# Run in Supabase Wallet SQL Editor:
# File: docs/schema/wallet_tables.sql (CREATE TABLE statements)
# Also run:

migrations/paywave_complete_system.sql
migrations/opay_rpcs.sql
migrations/web3_improvements.sql

-- Apply indexes
CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX idx_payments_user ON payments(user_id, created_at);
CREATE INDEX idx_wallet_history_wallet ON wallet_history(wallet_id, created_at);
```

---

## 📤 DATA MIGRATION (OLD → NEW)

### Export from Old Supabase
```bash
# Export profiles table
supabase db pull --schema public
# This creates a migration file with full schema

# Export specific tables as CSV
pg_dump \
  -h old-supabase.db.supabase.co \
  -U postgres \
  -d postgres \
  -t profiles \
  --csv > profiles.csv

# Or use Supabase CLI
supabase db download
```

### Import to New Projects
```bash
# Option 1: Use Supabase Import Tool (GUI)
# Upload CSV files in Supabase Dashboard → Table Editor → Import

# Option 2: Direct SQL Insert (for small tables)
# Read CSV, create INSERT statements, paste in SQL Editor

# Option 3: Use Python script
python3 migrate_data.py \
  --source-url old-supabase \
  --dest-url new-identity \
  --tables profiles,users
```

### Verify Migration
```bash
# Check row counts match
psql -h pevhyriszemvnrwvfshm.db.supabase.co -U postgres -d postgres \
  -c "SELECT COUNT(*) FROM profiles;"

psql -h hhqohlzzpzgkfdeanudw.db.supabase.co -U postgres -d postgres \
  -c "SELECT COUNT(*) FROM posts;"

psql -h wyqtcjqbdniwebvrwdnk.db.supabase.co -U postgres -d postgres \
  -c "SELECT COUNT(*) FROM wallets;"
```

---

## 🔧 STORAGE MIGRATION

### Copy Buckets
```bash
# Export from old Supabase
aws s3 sync s3://old-supabase-bucket/post-images/ ./post-images/

# Import to new Core Supabase
aws s3 sync ./post-images/ s3://new-core-bucket/post-images/

# Or use gsutil for Google Cloud Storage (if used)
gsutil -m cp -r gs://old-bucket/post-images gs://new-bucket/
```

---

## ✅ VERIFICATION CHECKLIST

### Per-Project Checks
```bash
# Check all functions deployed
for func in $(supabase functions list --project-ref pevhyriszemvnrwvfshm | awk '{print $1}'); do
  curl -s -o /dev/null -w "$func: %{http_code}\n" \
    https://pevhyriszemvnrwvfshm.functions.supabase.co/$func
done

# Check secrets are set
supabase secrets list --project-ref pevhyriszemvnrwvfshm

# Check database connectivity
psql -h pevhyriszemvnrwvfshm.db.supabase.co -U postgres -d postgres -c "SELECT 1;"
```

### Smoke Tests
```bash
# Test Identity: Create user & enable 2FA
curl -X POST https://app-url/api/auth/signup \
  -d '{"email":"test@test.com","password":"test123"}'

# Test Core: Create post
curl -X POST https://app-url/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"Test post"}'

# Test Wallet: Check balance
curl -X GET https://app-url/api/wallet/balance \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🛑 ROLLBACK PROCEDURE

If something breaks:

```bash
# Step 1: Disable feature flag in frontend
REACT_APP_USE_MULTI_SUPABASE=false

# Step 2: Deploy old version
npm run build
vercel deploy

# Step 3: Point frontend to old Supabase
# In .env.production:
REACT_APP_SUPABASE_URL=https://old-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=...

# Step 4: Redeploy
npm run build && vercel deploy --prod

# Step 5: Keep new Supabase projects active as backup
# Don't delete - keep running for 2 weeks in case issues found
```

---

## 📊 MONITORING & ALERTS

After deployment, monitor:

```bash
# Check function performance
supabase functions list --project-ref hhqohlzzpzgkfdeanudw
# Review "Duration", "Error Count" columns

# Check database queries
# Supabase Dashboard → Database → Logs → Slow Queries

# Monitor API usage
# Supabase Dashboard → Usage → API Requests

# Set up alerts in Supabase dashboard
# Settings → Monitoring → Add alert on function errors
```

---

## 📝 TIMELINE ESTIMATE

**Per Phase**:
- Phase 1 (Identity): 15 minutes (7 functions)
- Phase 2 (Core): 32 minutes (14 functions)
- Phase 3 (Wallet): 60 minutes (23 functions)
- Data Migration: 2-4 hours
- Testing & Verification: 1-2 hours

**Total: 5-8 hours of active work**

---

**Ready to start Phase 1?** 🚀

Run this to begin:
```bash
supabase login
supabase link --project-ref pevhyriszemvnrwvfshm
```
