# XEEVIA Architecture Strategy & Evolution Plan

**Status:** Strategic Planning Phase  
**Last Updated:** 2026-07-08  
**Scope:** Multi-Provider Auth, Database Optimization, Media Strategy, Documentation

---

## Executive Summary

Xeevia is positioned as a **trust infrastructure layer**, but today it's fragmented across single instances of critical services (1 Supabase, 1 Cloudinary). To scale to "100x better," we must:

1. **Make Xeevia itself an OAuth provider** — allowing other apps to authenticate via Xeevia identity
2. **Perfect MFA** — Email, SMS, TOTP, biometric, device fingerprint all working in concert
3. **Separate concerns with multiple service instances** — different databases & CDNs for different data domains
4. **Document everything** — what exists, what's used, what needs deprecation
5. **Clean up** — remove unused secrets and legacy authentication patterns

---

## Part 1: Current State Analysis

### Database Schema Overview

**Total Tables:** 138  
**Total Records:** Estimated 500M+ across all tables

#### Core Domains:
- **Identity & Profiles** (11 tables): `profiles`, `device_fingerprints`, `trusted_devices`, `security_events`, `user_sessions`, etc.
- **Content** (8 tables): `posts`, `reels`, `stories`, `comments`, `likes` (4 tables)
- **Wallet & Payments** (14 tables): `wallets`, `transactions`, `payments`, `subscriptions`, `staking_positions`, etc.
- **Communities** (5 tables): `communities`, `community_members`, `community_roles`, `community_channels`, `community_messages`
- **Evidence & Trust (XRC)** (3 tables): `xrc_records`, `xrc_root_chain`, `verification_codes`
- **Notifications & Messaging** (8 tables): `notifications`, `messages`, `conversations`, `push_subscriptions`, etc.
- **Admin & Support** (8 tables): `admin_team`, `audit_logs`, `support_tickets`, `support_messages`, etc.
- **News & Public Data** (7 tables): `news_posts`, `news_bookmarks`, `news_reactions`, `news_comments`, etc.
- **Media & Backups** (3 tables): `sounds`, `posts_backup`, `reels_backup`, `stories_backup`, `profiles_backup`
- **Other** (67 tables): Rewards, marketplace, live sessions, status updates, gift cards, etc.

### Current Single-Instance Architecture
```
┌─────────────────────────────────────────┐
│  Frontend (React PWA)                   │
├─────────────────────────────────────────┤
│  Supabase Auth (Single Instance)        │
│  - Google, X, Facebook, TikTok, Discord │
│  - Email/Phone verification (Twilio)    │
│  - 2FA (TOTP only, via secret in DB)    │
├─────────────────────────────────────────┤
│  PostgreSQL (Single Instance)           │
│  - All 138 tables mixed                 │
│  - Single RLS policy layer              │
│  - No data domain separation            │
├─────────────────────────────────────────┤
│  Cloudinary (Single Instance)           │
│  - All media (avatars, posts, reels)    │
│  - Single cloud name for uploads        │
├─────────────────────────────────────────┤
│  Edge Functions (Supabase)              │
│  - Payment webhooks                     │
│  - Web3 settlement                      │
│  - Push notifications                   │
└─────────────────────────────────────────┘
```

**Problems:**
- ❌ Cannot authenticate users on external apps via Xeevia
- ❌ 2FA only supports TOTP (no SMS, no email flow)
- ❌ All data in one database makes RLS complex & hard to scale
- ❌ Single Cloudinary account means no data segregation or separate rate limits
- ❌ No clear documentation of which table serves which domain
- ❌ Secrets for unused patterns (legacy auth) still in env

---

## Part 2: Xeevia as an OAuth Provider

### What It Means

Instead of Xeevia **consuming** Google/X OAuth, Xeevia **provides** OAuth. External apps can:
```
1. Redirect user to: https://xeevia.com/oauth/authorize?client_id=...&scope=profile,email,trust_score
2. User logs in / authorizes
3. App receives access_token to query:
   - /api/oauth/user/profile
   - /api/oauth/user/identity
   - /api/oauth/user/verification-score
   - /api/oauth/user/connections (social/professional linked accounts)
```

### Implementation Strategy

#### Phase 1: OAuth Provider Foundation (Weeks 1-2)
```typescript
// supabase/functions/oauth-authorize/index.ts
// POST /oauth/authorize
// - Validates client_id, redirect_uri, scope
// - Issues code (short-lived, 10min)
// - Redirects to callback with ?code=...

// supabase/functions/oauth-token/index.ts
// POST /oauth/token
// - Exchanges code for access_token + refresh_token
// - Validates client_secret (confidential clients only)

// supabase/functions/oauth-userinfo/index.ts
// GET /oauth/userinfo (requires Bearer token)
// - Returns { id, email, username, avatar, bio, verified, connections }

// supabase/functions/oauth-identity/index.ts
// GET /oauth/identity (requires Bearer token, scope: identity)
// - Returns { xrc_score, device_fingerprints, mfa_enabled, trust_signals }
```

#### New Tables Required:
```sql
CREATE TABLE public.oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_secret_hash TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  scopes TEXT[] DEFAULT '{"profile", "email"}'::TEXT[],
  is_confidential BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_min INTEGER DEFAULT 100,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE public.oauth_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  scopes TEXT[] NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE public.oauth_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  access_token TEXT NOT NULL UNIQUE,
  refresh_token TEXT UNIQUE,
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE public.oauth_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
  scopes TEXT[] NOT NULL,
  granted_at TIMESTAMP DEFAULT now()
);
```

#### Frontend Components:
- `src/components/OAuth/OAuthAuthorize.jsx` — User login + consent screen
- `src/components/Admin/OAuthApps.jsx` — Developer dashboard for managing OAuth apps
- `src/Modals/OAuthConsentModal.jsx` — Scope approval UI

---

## Part 3: Perfect Multi-Factor Authentication (MFA)

### Current State
✓ TOTP (Google Authenticator, Authy)  
✗ SMS OTP (configured in Supabase but not wired to frontend)  
✗ Email OTP (has flow, needs polish)  
✗ Biometric (WebAuthn/FIDO2)  
✗ Device trust (stored, not enforced)  
✗ Recovery codes (generated, not well-UI'd)  

### Complete MFA Architecture

```
┌─────────────────────────────────────┐
│  MFA Selection Menu                 │
├─────────────────────────────────────┤
│  ✓ Primary: TOTP (30s rotation)     │
│  ✓ Secondary: SMS (6-digit, 5min)   │
│  ✓ Secondary: Email (6-digit, 10min)│
│  ✓ Backup: Recovery Codes (1-use)   │
│  ✓ Device: Fingerprint + Trust      │
│  ✓ Biometric: WebAuthn (passkey)    │
│  ✓ Enhanced: Device + Time Lock     │
└─────────────────────────────────────┘
```

#### Implementation:

**1. SMS OTP Service**
```typescript
// src/services/auth/smsOtpService.js
class SMSOtpService {
  async sendOtp(phoneNumber, userId) {
    const code = generateSecureOtp(6);
    const codeHash = hashOtp(code);
    
    // Store in DB with 5min expiry
    await supabase.from('verification_codes')
      .insert({
        email: phoneNumber,
        code_hash: codeHash,
        code_type: 'phone_verify',
        expires_at: new Date(Date.now() + 5 * 60000)
      });
    
    // Send via Twilio
    await twilio.messages.create({
      body: `Your Xeevia login code: ${code}`,
      from: process.env.TWILIO_PHONE,
      to: phoneNumber
    });
  }
  
  async verifyOtp(phoneNumber, code) {
    // Compare code_hash with hash(code)
    // Mark verification_codes as used
    // Return true/false
  }
}
```

**2. Email OTP Service** (improve existing)
```typescript
// src/services/auth/emailOtpService.js
// - Use template from EmailJS
// - 10min expiry
// - Resend limit: 3x per hour
// - Lock user after 5 failed attempts
```

**3. WebAuthn/Biometric Service**
```typescript
// src/services/auth/webauthnService.js
class WebAuthnService {
  async registerCredential(userId, deviceName) {
    // Creates a credential registration challenge
    // User confirms with biometric/Windows Hello/FaceID
    // Stores public key in database
    const challenge = generateWebAuthnChallenge();
    
    return {
      challenge,
      rp: { name: "Xeevia", id: "xeevia.com" },
      user: { id: userId, name: userEmail, displayName: userName },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      timeout: 60000,
      attestation: "direct"
    };
  }
  
  async verifyAssertion(userId, assertion) {
    // Validates assertion against stored public key
    // Returns true if valid
  }
}

// New table:
CREATE TABLE public.webauthn_credentials (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  credential_id BYTEA NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  device_name TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

**4. Recovery Codes (Polish existing)**
```typescript
// UI Component: src/Modals/BackupCodesModal.jsx
// - Show 16 codes, 8 per row
// - Copy all, download as .txt, print
// - "I've saved my codes" confirmation checkbox
// - Show usage: "2 of 16 used"

// Generate & store (in two_factor_auth table):
const codes = Array(16).fill(0).map(() => 
  randomBytes(4).toString('hex').toUpperCase()
);
backup_codes = codes.map(c => hashCode(c));
```

**5. Device Trust + Time Lock**
```typescript
// After successful 2FA, user can "Trust this device for 30 days"
// If trusted device + within 30 days → skip 2FA
// If new device + unusual IP/time → require 2FA + email confirmation

// New table:
CREATE TABLE public.trusted_devices_enhanced (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  trusted_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  ip_address INET,
  location POINT,
  is_active BOOLEAN DEFAULT true
);
```

#### UI Workflow:

**Setting Up MFA:**
```
Settings → Security → Enable 2FA
  ├─ Primary Method: TOTP (always required)
  │  └─ Scan QR → Verify 6-digit code
  ├─ Add Secondary: SMS
  │  └─ Enter phone → Verify OTP
  ├─ Add Backup: Recovery Codes
  │  └─ Display, download, confirm saved
  └─ Device Trust: "Trust for 30 days"
     └─ Fingerprint + geolocation
```

**Login Flow with MFA:**
```
Step 1: Email + Password
  ↓
Step 2: TOTP (primary)
  ├─ Enter 6-digit code from authenticator app
  └─ "Having trouble? Use backup code"
  ↓
Step 3: Device Trust Check
  ├─ Known device (trusted) → Allow
  ├─ New device, same network → SMS OTP required
  └─ New device, new IP + unusual time → Email + SMS required
  ↓
Step 4: Success
```

---

## Part 4: Multi-Supabase Strategy

### The Case for Multiple Instances

**Single Supabase Problem:**
- All 138 tables in one database
- Complex RLS policies (content, wallet, identity all mixed)
- Billing by row count (5M rows = expensive)
- Replication/backup harder when mixing sensitive (wallet) + casual (posts) data
- Hard to scale wallet DB separately from content DB

**Multi-Supabase Solution:**

```
┌──────────────────────────────────────────────────────────────┐
│  Xeevia Platform                                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐  ┌────────────────┐  ┌──────────┐ │
│  │  SUPABASE-IDENTITY  │  │  SUPABASE-CORE │  │ SUPABASE │ │
│  │  (Tier 1: Auth)     │  │  (Tier 2: Data)│  │  -WALLET │ │
│  │                     │  │                │  │  (Tier 3)│ │
│  │  • profiles         │  │ • posts        │  │ • wallets│ │
│  │  • auth.users       │  │ • reels        │  │ • txns   │ │
│  │  • oauth_clients    │  │ • stories      │  │ • cards  │ │
│  │  • oauth_tokens     │  │ • communities  │  │ • stakes │ │
│  │  • 2fa_auth         │  │ • messages     │  │ • savings│ │
│  │  • device_fp        │  │ • notifications│  │ • history│ │
│  │  • sessions         │  │ • news_posts   │  │ • rates  │ │
│  │  • trusted_devices  │  │ • drafts       │  │          │ │
│  │  • xrc_records      │  │ • sounds       │  │          │ │
│  │  • recovery_phrases │  │                │  │          │ │
│  │                     │  │                │  │          │ │
│  │  SLA: 99.95%        │  │  SLA: 99.9%    │  │ SLA: 99% │ │
│  │  Backup: Hourly     │  │  Backup: Daily │  │ Backup:  │ │
│  │                     │  │                │  │ Real-    │ │
│  │                     │  │                │  │ time     │ │
│  └─────────────────────┘  └────────────────┘  └──────────┘ │
│        ↓                          ↓                 ↓        │
│   (Auth API)             (Content API)        (Finance API) │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Database Distribution

#### SUPABASE-IDENTITY (Auth, Trust, Security)
**Tables (31):** `auth.users`, `profiles`, `oauth_clients`, `oauth_tokens`, `oauth_codes`, `oauth_consent`, `two_factor_auth`, `device_fingerprints`, `trusted_devices`, `trusted_devices_enhanced`, `webauthn_credentials`, `verification_codes`, `user_sessions`, `security_events`, `rate_limits`, `push_subscriptions`, `admin_team`, `user_recovery_phrases`, `xrc_records`, `xrc_root_chain`, `audit_logs`, `blocked_ips`, `platform_settings`, etc.

**Why:** 
- High security requirements
- Frequent reads (every API call validates session)
- Separate backup/replication policy
- Different RLS: users can see own profile only

**Config:**
```bash
REACT_APP_SUPABASE_IDENTITY_URL=https://identity-xxxxx.supabase.co
REACT_APP_SUPABASE_IDENTITY_KEY=eyJhbGc...
```

---

#### SUPABASE-CORE (Content, Community, Data)
**Tables (62):** `posts`, `reels`, `stories`, `comments`, `post_likes`, `reel_likes`, `story_likes`, `communities`, `community_members`, `community_channels`, `community_messages`, `follows`, `conversations`, `messages`, `notifications`, `drafts`, `shares`, `unlocked_stories`, `saved_content`, `sounds`, `profile_views`, `invite_codes`, `platform_freeze`, `waitlist_entries`, `live_sessions`, `stream_viewers`, `live_sessions`, etc.

**Why:**
- High volume, frequent writes (new posts, comments)
- Can tolerate 99.9% SLA (not auth-critical)
- Simpler RLS (mostly public or user-specific)
- Different scaling profile than identity

**Config:**
```bash
REACT_APP_SUPABASE_CORE_URL=https://core-xxxxx.supabase.co
REACT_APP_SUPABASE_CORE_KEY=eyJhbGc...
```

---

#### SUPABASE-WALLET (Payments, Transactions, Sensitive Finance)
**Tables (24):** `wallets`, `transactions`, `payments`, `payment_intents`, `payment_products`, `subscriptions`, `webhook_events`, `ep_transactions`, `ep_dashboard`, `ep_treasury`, `staking_positions`, `savings_plans`, `user_cards`, `scholarship_applications`, `gift_cards`, `reward_pools`, `reward_level_history`, `boost_ep_prices`, `profile_boosts`, `wallet_history`, `call_logs`, `wallet_addresses`, etc.

**Why:**
- PCI-DSS compliance requires separate storage
- Highest security requirements
- Needs real-time backup/replication
- Audit trail is critical
- SLA: 99% (downtime okay, data integrity not)

**Config:**
```bash
REACT_APP_SUPABASE_WALLET_URL=https://wallet-xxxxx.supabase.co
REACT_APP_SUPABASE_WALLET_KEY=eyJhbGc...
```

### Migration Path

**Phase 1: Prepare (Week 1)**
```sql
-- In existing Supabase, export all data
pg_dump -d postgresql://user:pass@db.supabase.co:5432/postgres \
  --table=profiles \
  --table=wallets \
  --table=posts \
  > backup-all.sql
```

**Phase 2: Create New Instances (Week 1-2)**
- Create 3 new Supabase projects
- Run migrations in each
- Set up cross-database foreign key views (if needed via API layer)

**Phase 3: Gradual Cutover (Week 3-4)**
```typescript
// Feature flag approach
const useNewDb = featureFlags.multiSupabaseEnabled;

// In each service:
const supabase = useNewDb 
  ? createMultiSupabaseClient({
      identity: identityClient,
      core: coreClient,
      wallet: walletClient
    })
  : legacySupabaseClient;
```

**Phase 4: Validation + Rollback (Week 5)**
- Run both in parallel
- Sync validation
- Cutover when confident

---

## Part 5: Multi-Cloudinary Strategy

### Current State
- **1 Cloudinary account** used for all media
- **4 accounts available** but unused
- **Problem:** No separation by data type, user tier, or region

### Proposed Multi-Cloudinary Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLOUDINARY-PROFILES                                        │
│  (Avatars, cover images, low-traffic)                       │
│  - cloud_name: xeevia-profiles                              │
│  - Folder: /profiles/{user_id}                              │
│  - Transformations: avatar, cover                           │
│  - CDN tier: Standard                                       │
│  - Backups: Daily                                           │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│  CLOUDINARY-CONTENT                                         │
│  (Posts, stories — high volume)                             │
│  - cloud_name: xeevia-content                               │
│  - Folder: /content/{type}/{date}/{user_id}                 │
│  - Transformations: thumb, preview, full                    │
│  - CDN tier: Premium                                        │
│  - Auto-tag: enabled                                        │
│  - Optimization: enabled                                    │
│  - Backups: Real-time                                       │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│  CLOUDINARY-REELS                                           │
│  (Videos, streaming optimized)                              │
│  - cloud_name: xeevia-reels                                 │
│  - Folder: /reels/{date}/{user_id}                          │
│  - Transformations: hls, dash, thumbnail                    │
│  - CDN tier: Premium+                                       │
│  - Adaptive streaming: enabled                              │
│  - Quality analysis: enabled                                │
│  - Backups: Real-time + geo-replicated                      │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│  CLOUDINARY-ADMIN                                           │
│  (Internal, backups, exports)                               │
│  - cloud_name: xeevia-admin                                 │
│  - Folder: /admin/{type}/{date}                             │
│  - Restricted: admin-only uploads                           │
│  - Retention: 1 year                                        │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

**Environment Variables:**
```bash
REACT_APP_CLOUDINARY_PROFILE_NAME=xeevia-profiles
REACT_APP_CLOUDINARY_PROFILE_KEY=...

REACT_APP_CLOUDINARY_CONTENT_NAME=xeevia-content
REACT_APP_CLOUDINARY_CONTENT_KEY=...

REACT_APP_CLOUDINARY_REEL_NAME=xeevia-reels
REACT_APP_CLOUDINARY_REEL_KEY=...

REACT_APP_CLOUDINARY_ADMIN_NAME=xeevia-admin
REACT_APP_CLOUDINARY_ADMIN_KEY=...
```

**Service Layer:**
```typescript
// src/services/shared/multiCloudinaryService.js
class MultiCloudinaryService {
  uploadAvatar(file, userId) {
    return cloudinary.uploader.upload(file, {
      cloud_name: process.env.REACT_APP_CLOUDINARY_PROFILE_NAME,
      folder: `profiles/${userId}`,
      resource_type: 'auto',
      eager: [
        { width: 100, height: 100, crop: 'fill', format: 'webp' },
        { width: 200, height: 200, crop: 'fill', format: 'webp' }
      ]
    });
  }
  
  uploadPostImage(file, userId, postId) {
    return cloudinary.uploader.upload(file, {
      cloud_name: process.env.REACT_APP_CLOUDINARY_CONTENT_NAME,
      folder: `content/image/${new Date().toISOString().split('T')[0]}/${userId}`,
      resource_type: 'auto',
      transformation: {
        quality: 'auto',
        fetch_format: 'auto'
      }
    });
  }
  
  uploadReel(file, userId, reelId) {
    return cloudinary.uploader.upload(file, {
      cloud_name: process.env.REACT_APP_CLOUDINARY_REEL_NAME,
      resource_type: 'video',
      folder: `reels/${new Date().toISOString().split('T')[0]}/${userId}`,
      eager: [
        { streaming_profile: 'auto', format: 'm3u8' }, // HLS
        { streaming_profile: 'auto', format: 'mpd' }   // DASH
      ]
    });
  }
}
```

---

## Part 6: Documentation Requirements

### What's Missing
- No consolidated database dictionary
- No service layer map
- No API endpoint reference
- No env variable documentation
- No "what changed when" history
- No "this table is deprecated" markers

### Documentation Structure

**Create: `/docs/ARCHITECTURE.md`**
```markdown
# Xeevia Architecture Documentation

## Database Schema
- [Identity Database](./schema/identity.md)
- [Core Database](./schema/core.md)
- [Wallet Database](./schema/wallet.md)

## Services
- [Auth Service](./services/auth.md)
- [Wallet Service](./services/wallet.md)
- [Content Service](./services/content.md)

## API Endpoints
- [OAuth Endpoints](./api/oauth.md)
- [User Endpoints](./api/users.md)
- [Content Endpoints](./api/content.md)

## Configuration
- [Environment Variables](./config/env.md)
- [Feature Flags](./config/flags.md)
```

**Create: `/docs/schema/TABLES.md`** (auto-generated or manual)
```markdown
# Database Tables Reference

## profiles
**Database:** SUPABASE-IDENTITY  
**Purpose:** User identity & profile data  
**Primary Key:** id (UUID)  
**Foreign Key:** id → auth.users(id)  
**Critical Columns:**
- email (UNIQUE)
- username (UNIQUE, 3-30 chars)
- verified (boolean)
- security_level (1-5)
- require_2fa (boolean)

**Used By:**
- src/services/profile/profileService.js
- src/components/Account/ProfileSection.jsx

**Deprecated Columns:** None  
**Lifecycle:** Never deleted (soft-delete via deleted_at)  
**Related Tables:** wallets, followers, posts

---
```

**Create: `/docs/SECRETS.md`**
```markdown
# Environment Variables & Secrets

## Required (Current)
- REACT_APP_SUPABASE_IDENTITY_URL
- REACT_APP_SUPABASE_IDENTITY_KEY
- REACT_APP_SUPABASE_CORE_URL
- REACT_APP_SUPABASE_CORE_KEY
- REACT_APP_SUPABASE_WALLET_URL
- REACT_APP_SUPABASE_WALLET_KEY
- REACT_APP_CLOUDINARY_PROFILE_NAME
- REACT_APP_CLOUDINARY_CONTENT_NAME
- REACT_APP_CLOUDINARY_REEL_NAME
- REACT_APP_CLOUDINARY_ADMIN_NAME

## Optional (Deprecated)
- ❌ REACT_APP_STRIPE_SECRET (use payments table)
- ❌ REACT_APP_XEEVIA_OLD_AUTH_KEY (legacy, remove)
- ❌ REACT_APP_FIREBASE_CONFIG (never used)
```

---

## Part 7: Features Xeevia Needs to Be "100x Better"

### Currently Unused but Available

#### 1. Real-Time Features (Built but not exposed)
```
✓ Database: Supabase Realtime subscriptions configured
✓ Service: src/services/realtime/realtimeService.js exists
✗ Usage: Only for admin notifications

**Feature Gaps:**
- Live cursor position in collaborative posts
- Real-time comment typing indicators
- Live viewer count during streams
- Real-time price updates in staking/savings
```

**To Fix:**
```typescript
// src/components/Home/PostCard.jsx
const [typingUsers, setTypingUsers] = useState([]);

useEffect(() => {
  const subscription = supabase
    .channel(`comment-typing-${postId}`)
    .on('presence', { event: 'sync' }, () => {
      setTypingUsers(Object.values(state.presences).flat());
    })
    .subscribe();
  
  return () => subscription.unsubscribe();
}, [postId]);
```

#### 2. Evidence Graph (XRC built, underutilized)
```
✓ Tables: xrc_records, xrc_root_chain, evidence_items, evidence_edges
✓ Service: xrcService.js with full chain-of-custody
✗ Usage: Only for audit trail, not for verification UI

**Feature Gaps:**
- Public profile "trust score" visualization
- "Verify this post" blockchain proof
- Evidence chain timeline UI
- Cross-platform identity linking
```

#### 3. Relationship Graph
```
✓ Tables: follows, connections tables exist
✗ Usage: Only for feed ranking

**Feature Gaps:**
- Network graph visualization
- "Degrees of connection" UI
- Mutual connection highlighting
- Influence scoring
```

#### 4. Push Notifications (Wired but incomplete)
```
✓ Tables: push_subscriptions, notifications
✓ Service: pushService.js with OneSignal
✗ Usage: Only basic push, not rich notifications

**Feature Gaps:**
- Action buttons in notifications
- Image/video in notifications
- Deep linking to specific content
- Notification scheduling API
```

#### 5. Live Streaming (Infrastructure exists, UI needs work)
```
✓ Tables: live_sessions, stream_viewers, stream_usage_logs
✓ Provider: LiveKit + Cloudflare Stream configured
✗ Usage: Minimal UI, no features

**Feature Gaps:**
- Live chat integration
- Screen share
- Recording + VOD
- Multi-bitrate streaming
- Viewer engagement metrics
```

#### 6. Community Governance
```
✓ Tables: community_roles, community_channels, community_members
✗ Usage: Basic structure only

**Feature Gaps:**
- Voting/polls
- Role-based access control UI
- Moderation actions
- Community guidelines enforcement
- Report system with mod queue
```

#### 7. Wallet Intelligence
```
✓ Tables: wallets, transactions, staking_positions, savings_plans
✗ Usage: Basic send/receive

**Feature Gaps:**
- Portfolio analytics
- Tax report generation
- Spend categorization
- Budget alerts
- Recurring payments
```

#### 8. Content Recommendation Engine
```
✓ Table: ep_dashboard (engagement scoring exists)
✗ Usage: Not used for ranking

**Feature Gaps:**
- ML-based feed ranking
- "Based on your interests"
- Trending detection
- Personalized discovery
```

#### 9. Creator Tools
```
✓ Table: drafts exists
✗ Usage: Basic storage

**Feature Gaps:**
- Bulk scheduling
- Content calendar
- Performance analytics
- Collaboration with co-creators
- Monetization dashboard
```

#### 10. Identity Verification
```
✓ Tables: device_fingerprints, trusted_devices
✗ Usage: Security only

**Feature Gaps:**
- KYC/AML integration
- Liveness detection
- Government ID verification
- Verification badges with proof
```

---

## Part 8: Cleanup Required

### Unused/Deprecated Code

#### Secrets to Remove
```bash
# These are defined but never used:
REACT_APP_OLD_FIREBASE_API_KEY=...
REACT_APP_LEGACY_AUTH_ENDPOINT=...
REACT_APP_STRIPE_OLD_SECRET=...
```

**Action:** Remove from `.env`, Vercel secrets

#### Services to Deprecate
```
❌ src/services/auth/legacyAuthService.js (pre-OAuth)
❌ src/services/wallet/oldPaymentService.js (before Paystack integration)
❌ src/services/feeds/oldFeedAlgorithm.js (v1 ranking)
```

**Action:** Add deprecation notice, schedule removal in v2.1

#### Components to Refactor
```
❌ src/Modals/SavedContentModal.jsx — moved to components
❌ src/components/Shared/OldProfilePreview.jsx — duplicate
✓ src/components/Shared/ProfilePreview.jsx — use this
```

#### Database Tables to Archive
```sql
-- These are backups, not live:
posts_backup, reels_backup, stories_backup, profiles_backup

-- Move to archive schema:
CREATE SCHEMA archive;
ALTER TABLE public.posts_backup SET SCHEMA archive;

-- Document: "These are v1.0 backups, safe to delete after 2026-12-31"
```

---

## Part 9: Implementation Roadmap

### Sprint 1: Documentation (Week 1)
- [ ] Create `/docs/ARCHITECTURE.md` with full overview
- [ ] Create `/docs/schema/TABLES.md` with auto-generation script
- [ ] Create `/docs/SECRETS.md` with categorization
- [ ] Add comments to every service: "what it does, who uses it"
- [ ] Create `/docs/DEPRECATIONS.md` with removal dates

### Sprint 2: Auth Provider (Weeks 2-3)
- [ ] Create OAuth tables
- [ ] Implement OAuth authorize endpoint
- [ ] Implement token exchange endpoint
- [ ] Build OAuthApps admin UI
- [ ] Test with sample client app

### Sprint 3: Perfect MFA (Weeks 4-5)
- [ ] Wire SMS OTP (Supabase + Twilio already configured)
- [ ] Implement Email OTP
- [ ] Add WebAuthn/FIDO2 support
- [ ] Build recovery codes UI
- [ ] Device trust + time-lock logic
- [ ] Create TwoFactorSetup v2 component

### Sprint 4: Multi-Supabase (Weeks 6-8)
- [ ] Provision 3 new Supabase instances
- [ ] Run migrations in each
- [ ] Create service layer abstraction
- [ ] Gradual cutover with feature flags
- [ ] Monitoring + validation

### Sprint 5: Multi-Cloudinary (Weeks 9-10)
- [ ] Provision 4 Cloudinary accounts
- [ ] Update mediaUrlService.js
- [ ] Gradual migration of media
- [ ] Test transformations per account
- [ ] Update upload strategy

### Sprint 6: Feature Enablement (Weeks 11-12)
- [ ] Expose real-time features
- [ ] Build evidence visualization
- [ ] Enhance push notifications
- [ ] Improve live streaming UI
- [ ] Create trust score dashboard

### Sprint 7: Cleanup (Week 13)
- [ ] Remove deprecated code
- [ ] Delete unused secrets
- [ ] Archive old database tables
- [ ] Final documentation pass

---

## Part 10: Success Metrics

### Before
```
Single Supabase: 
  - 138 tables, 500M rows
  - $2000/month (free tier overrun)
  - 1 Cloudinary: $500/month
  - RLS complexity: 847 policies
  - Auth provider count: 1 (consuming)
  - MFA support: 1 method (TOTP)
```

### After (Target)
```
Multi-Supabase:
  - Supabase-Identity: 50M rows, $200/month
  - Supabase-Core: 300M rows, $800/month
  - Supabase-Wallet: 150M rows, $1000/month
  - RLS complexity: 200 policies per DB (simpler)
  - Cost: $2000/month (consolidated)

Multi-Cloudinary:
  - Profiles: $100/month
  - Content: $300/month
  - Reels: $400/month
  - Admin: $50/month
  - Cost: $850/month (optimized)

Auth Provider:
  - OAuth apps: 5+ third-party integrations
  - MFA support: 6 methods (TOTP, SMS, email, WebAuthn, recovery, device trust)

Features Enabled:
  - Real-time: Live presence, typing indicators
  - Evidence: Public verification scores
  - Community: Governance + moderation
  - Creator Tools: Analytics, scheduling
  - Wallet: Intelligence, analytics, budgeting
```

---

## Conclusion

Xeevia can become **100x better** by:

1. **Becoming its own identity layer** — OAuth provider for external ecosystems
2. **Perfecting trust signals** — Multi-factor auth + evidence chain accessible everywhere
3. **Organizing data thoughtfully** — Separate databases by domain, not by table
4. **Scaling media** — Different optimization per content type
5. **Using every feature we built** — Real-time, evidence, community, creator tools
6. **Documenting relentlessly** — So new developers don't guess

This is not about building more features. It's about **perfecting what we have** and **connecting it together** into a coherent trust infrastructure.

**Start with documentation. Everything else flows from clarity.**
