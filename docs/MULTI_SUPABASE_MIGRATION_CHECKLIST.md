# 🎯 MULTI-SUPABASE MIGRATION COMPLETE CHECKLIST

**Status**: Ready to Execute  
**Timeline**: 3-4 weeks  
**Scope**: Split 1 Supabase into 3 projects + migrate 138 tables + storage/buckets

---

## 📋 PROJECT REFERENCES

```
Xeevia Identity   → pevhyriszemvnrwvfshm
Xeevia Core       → hhqohlzzpzgkfdeanudw
Xeevia Wallet     → wyqtcjqbdniwebvrwdnk
```

---

## 📊 FUNCTION AUDIT & MAPPING

### ✅ Total Functions: 43 (Ready to Deploy)

| Project | Count | Status |
|---------|-------|--------|
| **Identity** | 7 | ✅ Ready |
| **Core** | 14 | ✅ Ready |
| **Wallet** | 22 | ✅ Ready |

### 🔐 IDENTITY PROJECT (7 functions)

**Project Ref**: `pevhyriszemvnrwvfshm`

Functions to deploy:
```
1. generate-2fa
2. verify-2fa-login
3. verify-2fa-setup
4. identity-sync
5. send-auth-email
6. generate-deeplink
7. store-connection-token ✨ (NEW - Identity token storage)
```

**Secrets Required**:
```
IDENTITY_SUPABASE_URL=https://pevhyriszemvnrwvfshm.supabase.co
IDENTITY_SUPABASE_ANON_KEY=<anon-key>
IDENTITY_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
TWO_FA_ENCRYPTION_KEY=<32-byte-hex>
BREVO_API_KEY=<api-key>
```

**Tables to Migrate** (35 tables):
```
IDENTITY DOMAIN:
├── Authentication & Profile
│   ├── profiles
│   ├── auth.users (Supabase Auth)
│   └── invite_codes
│
├── Security & MFA
│   ├── two_factor_auth
│   ├── device_fingerprints
│   ├── trusted_devices
│   ├── security_events
│   ├── rate_limits
│   ├── user_sessions
│   └── verification_codes
│
├── Social Connections
│   ├── follows
│   ├── connections (OAuth tokens - encrypted)
│   ├── connection_logs
│   └── oauth_clients (NEW)
│   └── oauth_codes (NEW)
│   └── oauth_tokens (NEW)
│   └── oauth_consent (NEW)
│
├── Account Management
│   ├── invite_code_usage
│   ├── waitlist_entries
│   ├── user_recovery_phrases
│   └── recovery_backup
│
└── Audit & Logging
    ├── audit_logs
    ├── security_events
    └── notification_preferences
```

---

### 📱 CORE PROJECT (14 functions)

**Project Ref**: `hhqohlzzpzgkfdeanudw`

Functions to deploy:
```
1. enhance-post
2. fetch-news
3. generate-media-url
4. generate-upload-signature
5. getCultureContent
6. publish-platform
7. relationship-graph
8. send-push
9. stream
10. subscription-sync
11. activate-free-code
12. accept-offer
13. create-offer
14. proxy-fetch
```

**Secrets Required**:
```
CORE_SUPABASE_URL=https://hhqohlzzpzgkfdeanudw.supabase.co
CORE_SUPABASE_ANON_KEY=<anon-key>
CORE_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ANTHROPIC_API_KEY=<api-key>
ONESIGNAL_APP_ID=<app-id>
ONESIGNAL_REST_API_KEY=<rest-api-key>
VAPID_PUBLIC_KEY=<vapid-public>
VAPID_PRIVATE_KEY=<vapid-private>
LIVEKIT_URL=<livekit-url>
LIVEKIT_API_KEY=<api-key>
LIVEKIT_API_SECRET=<secret>
CLOUDINARY_CLOUD_NAME=<cloud-name>
```

**Tables to Migrate** (65 tables):
```
CORE DOMAIN:
├── Content
│   ├── posts
│   ├── reels
│   ├── stories
│   ├── comments
│   ├── shares
│   ├── drafts
│   └── sounds
│
├── Social Interactions
│   ├── post_likes
│   ├── reel_likes
│   ├── story_likes
│   ├── comment_likes
│   ├── unlocked_stories
│   └── saved_content
│
├── Communities
│   ├── communities
│   ├── community_members
│   ├── community_roles
│   ├── community_channels
│   ├── community_messages
│   └── community_invites
│
├── Messaging & Notifications
│   ├── conversations
│   ├── messages
│   ├── message_reactions
│   ├── message_reads
│   ├── deleted_messages
│   ├── hidden_conversations
│   ├── notifications
│   ├── push_subscriptions
│   ├── push_notifications
│   └── notification_badge_state
│
├── Media & Streaming
│   ├── live_sessions
│   ├── stream_viewers
│   ├── stream_usage_logs
│   ├── stream_tier_limits
│   └── call_logs
│
├── Activity & Views
│   ├── profile_views
│   ├── news_views
│   └── xrc_records (Evidence)
│
├── News & Content Discovery
│   ├── news_posts
│   ├── news_bookmarks
│   ├── news_reactions
│   ├── news_comments
│   └── news_fetch_log
│
├── Status & Presence
│   ├── status_updates
│   └── status_likes
│
├── Admin Content Management
│   ├── comment_reports
│   ├── support_cases
│   ├── support_tickets
│   └── support_messages
│
└── Metadata
    ├── upload_rate_limits
    ├── notification_preferences
    └── xrc_root_chain
```

---

### 💳 WALLET PROJECT (22 functions)

**Project Ref**: `wyqtcjqbdniwebvrwdnk`

Functions to deploy:
```
1. deposit-flutterwave-checkout
2. deposit-opay-checkout
3. deposit-paystack-init
4. deposit-paystack-webhook
5. paystack-create-transaction
6. paystack-webhook
7. withdraw-opay
8. withdraw-paystack-init
9. withdraw-paystack-webhook
10. webhook-flutterwave
11. webhook-opay
12. webhook-xrc-settlement
13. listener-web3-settlement
14. oracle-proof
15. web3-initiate-payment
16. web3-payment-status
17. web3-poll-pending
18. web3-submit-payment
19. web3-verify-payment
20. web3-webhook-listener
21. stripe-create-session
22. stripe-webhook
23. trade-actions
```

**Secrets Required**:
```
WALLET_SUPABASE_URL=https://wyqtcjqbdniwebvrwdnk.supabase.co
WALLET_SUPABASE_ANON_KEY=<anon-key>
WALLET_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
PAYSTACK_SECRET_KEY=<secret-key>
PAYSTACK_PUBLIC_KEY=<public-key>
OPAY_API_KEY=<api-key>
OPAY_SECRET_KEY=<secret-key>
OPAY_MERCHANT_ID=<merchant-id>
FLUTTERWAVE_SECRET_KEY=<secret-key>
STRIPE_SECRET_KEY=<secret-key>
STRIPE_WEBHOOK_SECRET=<webhook-secret>
POLYGON_RPC_URL=<rpc-url>
BASE_RPC_URL=<rpc-url>
SOLANA_RPC_URL=<rpc-url>
ARBITRUM_RPC_URL=<rpc-url>
ETH_RPC_URL=<rpc-url>
BSC_RPC_URL=<rpc-url>
BLOCKFROST_API_KEY=<api-key>
TREASURY_WALLET_EVM=<address>
TREASURY_WALLET_SOL=<address>
TREASURY_WALLET_ADA=<address>
TREASURY_WALLET_TRON=<address>
ORACLE_HMAC_KEY=<hmac-key>
ORACLE_KEY_ID=<key-id>
```

**Tables to Migrate** (38 tables):
```
WALLET DOMAIN:
├── Wallet & Balance
│   ├── wallets
│   ├── wallet_addresses
│   ├── wallet_history
│   └── ep_dashboard
│
├── Transactions
│   ├── transactions
│   ├── ep_transactions
│   └── ep_treasury
│
├── Payments
│   ├── payments
│   ├── payment_products
│   ├── payment_intents
│   ├── subscriptions
│   ├── webhook_events
│   └── ep_treasury_config
│
├── Payment Methods
│   ├── user_cards
│   ├── billing_addresses
│   └── saved_payment_methods
│
├── Financial Products
│   ├── staking_positions
│   ├── savings_plans
│   └── investment_accounts
│
├── Web3 & Blockchain
│   ├── web3_payments
│   ├── blockchain_transactions
│   ├── contract_interactions
│   └── wallet_verification
│
├── Rewards & Incentives
│   ├── reward_pools
│   ├── reward_level_history
│   ├── profile_boosts
│   ├── boost_ep_prices
│   ├── daily_task_completions
│   └── gift_cards
│
├── Platform Revenue
│   ├── platform_revenue
│   ├── platform_settings (partial)
│   └── platform_freeze
│
└── Admin
    ├── blocked_ips
    ├── audit_log
    └── admin_team
```

---

## 🗄️ STORAGE BUCKETS TO MIGRATE

### Identity Project Buckets
```
1. profile-avatars/
   ├── 1000/ (user IDs)
   └── Purpose: Small profile pictures
   └── Size: ~500MB
   └── Cloudinary → xeevia-profiles
```

### Core Project Buckets
```
1. post-images/
   ├── 2024/ (by year)
   └── Purpose: User-generated post images
   └── Size: ~5GB
   └── Cloudinary → xeevia-content

2. post-videos/
   ├── 2024/
   └── Purpose: Short videos, reels
   └── Size: ~20GB
   └── Cloudinary → xeevia-reels

3. story-covers/
   ├── 2024/
   └── Purpose: Story cover images
   └── Size: ~2GB
   └── Cloudinary → xeevia-content

4. community-assets/
   ├── avatars/
   ├── banners/
   └── Purpose: Community media
   └── Size: ~500MB
   └── Cloudinary → xeevia-content
```

### Wallet Project Buckets
```
1. verification-docs/
   ├── kyc/
   ├── aml/
   └── Purpose: Compliance documents
   └── Size: ~1GB
   └── Keep in Wallet Supabase (sensitive)

2. receipt-archives/
   ├── 2024/
   └── Purpose: Payment receipts
   └── Size: ~500MB
   └── Keep in Wallet Supabase (sensitive)
```

---

## 🚀 DEPLOYMENT SEQUENCE

### PHASE 1: IDENTITY PROJECT (Days 1-3)

**Step 1.1: Prepare Identity Database**
- [ ] Log into Xeevia Identity Supabase
- [ ] Run migration: `create_identity_tables.sql`
- [ ] Create indexes on profiles, device_fingerprints, trusted_devices
- [ ] Enable RLS policies for auth domain
- [ ] Test: Can sign in? Can enable 2FA?

**Step 1.2: Deploy Identity Functions**
```bash
supabase login
supabase link --project-ref pevhyriszemvnrwvfshm

# Set secrets
supabase secrets set \
  IDENTITY_SUPABASE_URL=https://pevhyriszemvnrwvfshm.supabase.co \
  IDENTITY_SUPABASE_SERVICE_ROLE_KEY=... \
  TWO_FA_ENCRYPTION_KEY=... \
  BREVO_API_KEY=...

# Deploy 7 functions
supabase functions deploy generate-2fa
supabase functions deploy verify-2fa-login
supabase functions deploy verify-2fa-setup
supabase functions deploy identity-sync
supabase functions deploy send-auth-email
supabase functions deploy generate-deeplink
supabase functions deploy store-connection-token
```

**Step 1.3: Migrate Identity Data** (if needed)
- [ ] Export profiles from old Supabase
- [ ] Validate email/username uniqueness
- [ ] Import to new Identity project
- [ ] Run verification check: `SELECT COUNT(*) FROM profiles;`

**Step 1.4: Test Identity Flow**
- [ ] User can sign up
- [ ] User can enable TOTP 2FA
- [ ] User can verify 2FA
- [ ] Identity sync works
- [ ] OAuth tokens stored securely

**Step 1.5: Verify Functions**
- [ ] `https://pevhyriszemvnrwvfshm.functions.supabase.co/generate-2fa` → 200 OK
- [ ] Check function logs: `supabase functions list --project-ref pevhyriszemvnrwvfshm`
- [ ] Test 2FA flow end-to-end

---

### PHASE 2: CORE PROJECT (Days 4-7)

**Step 2.1: Prepare Core Database**
- [ ] Log into Xeevia Core Supabase
- [ ] Run migration: `create_core_tables.sql`
- [ ] Create indexes on posts, comments, communities
- [ ] Enable RLS policies for content domain
- [ ] Set up media transformations (Cloudinary)

**Step 2.2: Deploy Core Functions**
```bash
supabase link --project-ref hhqohlzzpzgkfdeanudw

# Set secrets (push, media, streaming, content)
supabase secrets set \
  CORE_SUPABASE_URL=... \
  CORE_SUPABASE_SERVICE_ROLE_KEY=... \
  ANTHROPIC_API_KEY=... \
  ONESIGNAL_APP_ID=... \
  ONESIGNAL_REST_API_KEY=... \
  LIVEKIT_URL=... \
  LIVEKIT_API_KEY=... \
  LIVEKIT_API_SECRET=...

# Deploy 14 functions
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

**Step 2.3: Migrate Core Data**
- [ ] Export posts, reels, stories from old Supabase
- [ ] Export communities & members
- [ ] Import to new Core project
- [ ] Verify: `SELECT COUNT(*) FROM posts; SELECT COUNT(*) FROM communities;`

**Step 2.4: Test Core Flow**
- [ ] User can create post
- [ ] User can upload media (image/video)
- [ ] User can comment
- [ ] Push notifications work
- [ ] News feed fetches
- [ ] Communities work

**Step 2.5: Verify Functions**
- [ ] All 14 functions deployed
- [ ] Media URL generation works
- [ ] Push notifications send
- [ ] Stream endpoints live

---

### PHASE 3: WALLET PROJECT (Days 8-11)

**Step 3.1: Prepare Wallet Database**
- [ ] Log into Xeevia Wallet Supabase
- [ ] Run migration: `create_wallet_tables.sql`
- [ ] Run: `migrations/paywave_complete_system.sql`
- [ ] Run: `migrations/opay_rpcs.sql`
- [ ] Run: `migrations/web3_improvements.sql`
- [ ] Create indexes on wallets, transactions, payments

**Step 3.2: Deploy Wallet Functions**
```bash
supabase link --project-ref wyqtcjqbdniwebvrwdnk

# Set secrets (payment providers + Web3 RPCs)
supabase secrets set \
  WALLET_SUPABASE_URL=... \
  WALLET_SUPABASE_SERVICE_ROLE_KEY=... \
  PAYSTACK_SECRET_KEY=... \
  OPAY_API_KEY=... \
  OPAY_SECRET_KEY=... \
  OPAY_MERCHANT_ID=... \
  STRIPE_SECRET_KEY=... \
  STRIPE_WEBHOOK_SECRET=... \
  POLYGON_RPC_URL=... \
  BASE_RPC_URL=... \
  SOLANA_RPC_URL=... \
  TREASURY_WALLET_EVM=... \
  ORACLE_HMAC_KEY=... \
  ORACLE_KEY_ID=...

# Deploy 23 functions
# (See full list above)
```

**Step 3.3: Migrate Wallet Data**
- [ ] Export wallets from old Supabase
- [ ] Export transactions & payments
- [ ] Export user cards
- [ ] Import to new Wallet project
- [ ] Verify: `SELECT COUNT(*) FROM wallets;`

**Step 3.4: Test Wallet Flow**
- [ ] Deposit flow works (Paystack, OPay)
- [ ] Withdrawal works (tier-based limits)
- [ ] Bill payments work (airtime, data)
- [ ] Web3 payments verified
- [ ] Webhooks receive correctly

**Step 3.5: Verify Functions**
- [ ] All 23 functions deployed
- [ ] Payment webhooks working
- [ ] Web3 settlement listener active
- [ ] Withdrawal RPC functions callable

---

## 🔗 FRONTEND SERVICE LAYER CHANGES

### Update Adapter Pattern
**File**: `src/services/supabase/multiClient.js`

```javascript
// CURRENT (single Supabase)
const supabase = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY);

// NEW (three Supabase)
class MultiSupabaseClient {
  constructor() {
    this.identity = createClient(
      process.env.REACT_APP_IDENTITY_SUPABASE_URL,
      process.env.REACT_APP_IDENTITY_ANON_KEY
    );
    this.core = createClient(
      process.env.REACT_APP_CORE_SUPABASE_URL,
      process.env.REACT_APP_CORE_ANON_KEY
    );
    this.wallet = createClient(
      process.env.REACT_APP_WALLET_SUPABASE_URL,
      process.env.REACT_APP_WALLET_ANON_KEY
    );
  }

  query(domain, table) {
    const client = this[domain] || this.identity;
    return client.from(table);
  }
}
```

### Update Services (No UI Changes)
- `authService.js` → use `multiClient.identity`
- `contentService.js` → use `multiClient.core`
- `walletService.js` → use `multiClient.wallet`
- `notificationService.js` → use `multiClient.core`

**Result**: Frontend components unchanged. Services layer handles routing.

---

## ✅ VERIFICATION CHECKLIST

### Post-Identity Deployment
- [ ] 7 functions live
- [ ] User signup works
- [ ] 2FA enabled
- [ ] Email verification sends
- [ ] identity-sync RPC callable

### Post-Core Deployment
- [ ] 14 functions live
- [ ] Posts created & stored
- [ ] Media uploads work
- [ ] Communities functional
- [ ] Push notifications sent
- [ ] News fetched

### Post-Wallet Deployment
- [ ] 23 functions live
- [ ] Deposit checkout works
- [ ] Withdrawal processes
- [ ] OPay bill payments work
- [ ] Web3 payments verified
- [ ] Webhooks received

### Multi-Supabase Integration
- [ ] Auth via Identity project ✓
- [ ] Content via Core project ✓
- [ ] Payments via Wallet project ✓
- [ ] Cross-project queries working
- [ ] Feature flag: `USE_MULTI_SUPABASE` enabled
- [ ] No frontend changes visible to user

---

## 🎯 CLOUDINARY MIGRATION (AFTER SUPABASE)

Once Supabase is stable, proceed with:

**4 Cloudinary Accounts**:
```
1. xeevia-profiles   → Avatars, covers
2. xeevia-content    → Post images, stories
3. xeevia-reels      → Videos, streaming
4. xeevia-admin      → Internal, backups
```

**Migration Steps**:
1. Create 4 accounts + get cloud names
2. Create `src/services/shared/multiCloudinaryService.js`
3. Migrate existing media (parallel run 1 week)
4. Switch frontend to use new accounts
5. Decommission old account

---

## 📝 ENVIRONMENT VARIABLES

**Frontend (.env.production)**:
```
REACT_APP_IDENTITY_SUPABASE_URL=https://pevhyriszemvnrwvfshm.supabase.co
REACT_APP_IDENTITY_ANON_KEY=...
REACT_APP_CORE_SUPABASE_URL=https://hhqohlzzpzgkfdeanudw.supabase.co
REACT_APP_CORE_ANON_KEY=...
REACT_APP_WALLET_SUPABASE_URL=https://wyqtcjqbdniwebvrwdnk.supabase.co
REACT_APP_WALLET_ANON_KEY=...
USE_MULTI_SUPABASE=true
```

---

## 🚨 ROLLBACK PLAN

If issues occur:
1. Keep old Supabase active for 2 weeks
2. Run data sync checks daily
3. If critical issue: revert `USE_MULTI_SUPABASE` flag to false
4. All data still in old Supabase

---

**Next**: Proceed with Phase 1 deployment checklist? ⚡
