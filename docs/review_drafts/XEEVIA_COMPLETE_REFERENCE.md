# Trimmed draft: XEEVIA_COMPLETE_REFERENCE.md
# XEEVIA: COMPLETE ARCHITECTURE REFERENCE

## Notes: This file has been trimmed to remove payment/web3/treasury sections for Xeevia-focused review.

## Trimmed content (first relevant lines)
# XEEVIA: COMPLETE ARCHITECTURE REFERENCE

**Purpose:** Single source of truth for Xeevia's complete state, transformation path, and scaling guide  
**Status:** Current production state → Definitive target state  
**Audience:** Any developer (human or AI) continuing this work from any point  

---

## PART 1: WHAT XEEVIA IS (Current Reality)

### Executive Foundation

### Current Infrastructure Stack

```
FRONTEND LAYER
├─ React 18.3.1 SPA (PWA)
├─ Lucide icons, OTP libraries
└─ Service Workers for offline + push

AUTH LAYER
├─ Supabase Auth (SINGLE INSTANCE)
│  ├─ OAuth Providers: Google, X, Facebook, TikTok, Discord
│  ├─ Email auth: configured but minimal
│  ├─ Phone auth: configured but unused
│  └─ 2FA: TOTP only (in two_factor_auth table)
├─ Session Management: user_sessions table (active, devices, timestamps)
└─ Security Events: Logged but not actionable

DATABASE LAYER
├─ PostgreSQL (SINGLE SUPABASE INSTANCE)
├─ 138 tables across 10 logical domains (mixed in one schema)
├─ RLS policies: Complex, 847+ rules
├─ Row-level security: User-owned data partially isolated
└─ Backup: Daily snapshots (retention: 7 days)

MEDIA LAYER
├─ Cloudinary (SINGLE ACCOUNT: xeevia-production)
├─ All content types: avatars, posts, videos, stories, reels
├─ Transformations: Limited (basic resize)
├─ CDN: Standard tier
└─ Rate limiting: 100 req/sec (shared across all content types)

├─ Flutterwave: Alternative processor
└─ Internal: EP (engagement points) economy

NOTIFICATION LAYER
├─ OneSignal: Push notifications (configured)
├─ EmailJS: Transactional email (configured)
├─ Twilio: SMS (configured)
└─ Service Workers: Background sync, offline notifications

EDGE FUNCTIONS LAYER
├─ 35+ Supabase Edge Functions deployed
└─ Invocation: Triggered by database changes or API calls

EVIDENCE LAYER (XRC)
├─ xrc_records table: Immutable chain of events
├─ xrc_root_chain table: Stream heads (XTRC, XERC, XARC, XCRC, XPRC, XSRC, XWRC)
├─ Purpose: Audit trail, not verification (UI not exposed)
└─ Status: Functional but unused
```

---

## PART 2: DATABASE SCHEMA BLUEPRINT (138 Tables Categorized)

### DOMAIN 1: IDENTITY & AUTHENTICATION (31 tables)
**Purpose:** User identity, session management, security, and trust signals  
**Criticality:** HIGHEST (every API call validates against this)  
**Current Issues:** Mixed with other concerns, hard to audit

| Table | Current Use | Dependencies | Status |
|-------|------------|--------------|--------|
| auth.users | Supabase auth IDs | Keycloak-like | ✓ Working |
| profiles | User identity | FK: auth.users | ✓ Working, missing: xeevia_as_oauth_provider |
| oauth_clients | NOT CREATED YET | N/A | ✗ Needed for Xeevia-as-OAuth |
| oauth_codes | NOT CREATED YET | N/A | ✗ Needed for Xeevia-as-OAuth |
| oauth_consent | NOT CREATED YET | N/A | ✗ Needed for Xeevia-as-OAuth |
| two_factor_auth | 2FA secrets | FK: profiles | ✓ TOTP only, SMS/email not wired |
| device_fingerprints | Device tracking | FK: profiles | ✓ Stored, not enforced |
| trusted_devices | Device trust whitelist | FK: profiles, device_fingerprints | ✓ Stored, not used in login flow |
| webauthn_credentials | NOT CREATED YET | N/A | ✗ Needed for biometric 2FA |
| verification_codes | OTP codes (hashed) | Generic email field | ⚠️ Works, but code_type generic |
| user_sessions | Session tracking | FK: profiles | ✓ Working, unused for device trust |
| security_events | Audit log | FK: profiles | ✓ Logged, not surfaced to users |
| rate_limits | Rate limiting | FK: profiles, ip_address | ✓ Tracked, not enforced |
| xrc_records | Immutable records | FK: profiles | ✓ Working, not exposed in UI |
| xrc_root_chain | Chain head tracking | FK: xrc_records | ✓ Working, not exposed in UI |
| admin_team | Admin users | FK: profiles, created_by | ✓ Working |
| audit_logs | Action audit trail | FK: profiles | ✓ Working, not accessible to users |
| blocked_ips | IP blocklist | FK: profiles (blocked_by) | ✓ Working |
| notification_preferences | Per-user notification settings | FK: profiles | ✓ Working |
| invite_codes | Invite system | FK: profiles (created_by) | ✓ Working |
| invite_code_usage | Invite tracking | FK: invite_codes, profiles (used_by) | ✓ Working |
| platform_settings | Global config | FK: profiles (updated_by) | ✓ Working |
| platform_freeze | Regional freeze state | FK: profiles (frozen_by) | ✓ Works |
| waitlist_entries | Waitlist tracking | FK: profiles, invite_codes | ✓ Works |
| notification_badge_state | Badge clear tracking | FK: profiles | ✓ Works |
| support_tickets | Support tracking | FK: profiles | ✓ Works |
| support_messages | Support messages | FK: support_tickets, profiles | ✓ Works |
| comment_reports | Report system | FK: comments, profiles (reporter_id) | ✓ Works |

**Action Required:**
- Create 4 missing OAuth tables
- Create webauthn_credentials table
- Wire SMS/email OTP to login flow
- Enforce device trust + time-lock in login

---

### DOMAIN 2: CONTENT & COMMUNITY (62 tables)
**Purpose:** Posts, reels, stories, comments, communities, messaging  
**Criticality:** HIGH (core app feature)  
**Current Issues:** Complex RLS policies, high volume, mixed with notifications

| Table | Current Use | Issue |
|-------|------------|-------|
| posts | Main feed content | ✓ Working |
| reels | Video content | ✓ Working, streaming not optimized |
| stories | Long-form content | ✓ Working, unlock cost enforced |
| comments | Nested comments | ✓ Working, threading UI basic |
| post_likes, reel_likes, story_likes, comment_likes | Like tracking (4 tables) | ✓ Working |
| communities | Community hubs | ✓ Created, governance UI missing |
| community_members | Member tracking | ✓ Working |
| community_roles | Role-based access | ✓ Defined, not enforced |
| community_channels | Channel organization | ✓ Created, not fully featured |
| community_messages | Community chat | ✓ Working |
| follows | Social graph | ✓ Working, recommendation engine not wired |
| conversations | 1-1 DM threads | ✓ Working |
| messages | DM content | ✓ Working, rich media limited |
| notifications | In-app notifications | ✓ Working, push not rich |
| message_reactions | Emoji reactions | ✓ Working |
| message_reads | Read receipts | ✓ Working |
| deleted_messages | Soft-delete tracking | ✓ Working |
| hidden_conversations | Archive 1-1 DMs | ✓ Working |
| drafts | Draft posts | ✓ Working, collaboration missing |
| shares | Share tracking | ✓ Working |
| saved_content | Bookmarks | ✓ Working |
| unlocked_stories | Unlock tracking | ✓ Working |
| sounds | Sound library | ✓ Minimal, trending not exposed |
| profile_views | Analytics tracking | ✓ Working, UI not exposed |
| live_sessions | Live streaming setup | ✓ Working, LiveKit/CF Stream configured, UI incomplete |
| stream_viewers | Live viewer tracking | ✓ Working |
| stream_usage_logs | Streaming analytics | ✓ Working, not exposed |
| stream_tier_limits | Streaming limits by tier | ✓ Defined, not enforced |
| news_posts | News feed | ✓ Working |
| news_bookmarks | News saves | ✓ Working |
| news_reactions | News engagement | ✓ Working |
| news_comments | News comments | ✓ Working |
| news_views | News tracking | ✓ Working |
| status_updates | Story-like status | ✓ Working |
| status_likes | Status engagement | ✓ Working |
| daily_task_completions | Gamification | ✓ Working, not surfaced |
| gift_cards | Gift card system | ✓ Working |
| call_logs | Call history | ✓ Tracked, UI basic |
| group_chats | Group DM setup | ✓ Working |
| active_calls | Call state tracking | ✓ Tracked, not real-time |
| news_fetch_log | News fetcher tracking | ✓ Working |
| ep_dashboard | EP metrics | ✓ Working, not exposed |
| scholarship_applications | Scholarship system | ✓ Working, UI not exposed |
| Plus 15 more community/content tables | Various | ✓ Mostly working |

**Action Required:**
- Move all to SUPABASE-CORE instance
- Simplify RLS policies (move user auth to separate instance)
- Enable real-time features (typing indicators, live viewers)
- Expose unused features (analytics, gamification, community governance)

---

**Purpose:** Financial transactions, staking, cards, revenue tracking  
**Criticality:** CRITICAL (PCI-DSS compliance required)  
**Current Issues:** Mixed with regular data, audit trail weak, revenue distribution manual

| Table | Current Use | Issue |
|-------|------------|-------|
| transactions | Transfer history | ✓ Working |
| subscriptions | Active subscriptions | ✓ Working |
| ep_transactions | EP ledger | ✓ Working, no manual spending |
| ep_dashboard | EP metrics | ✓ Working |
| staking_positions | Locked EP | ✓ Working, UI not exposed |
| savings_plans | Savings goals | ✓ Working, UI not exposed |
| user_cards | Card management | ✓ Working, virtual cards not created |
| reward_pools | Weekly reward pools | ✓ Defined, distribution manual |
| reward_level_history | Reward tier tracking | ✓ Logged, not real-time |
| boost_ep_prices | Boost pricing | ✓ Defined, not dynamic |
| profile_boosts | Active boosts | ✓ Working, renewal not automated |
| user_recovery_phrases | Seed recovery | ✓ Working |
| Plus 4 more finance tables | Various | ✓ Mostly working |

**Action Required:**
- Implement real-time auditing
- Automate reward distribution
- Enable staking/savings UI
- Implement card creation service

---

## PART 3: WHAT XEEVIA HAS (Actual Capabilities)
