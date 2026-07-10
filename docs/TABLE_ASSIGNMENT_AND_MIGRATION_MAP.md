# 🗄️ TABLE ASSIGNMENT & MIGRATION MAP

**Total Tables**: 138  
**Status**: Ready to migrate  
**Prepared by**: AI Engineering Team

---

## 📊 DISTRIBUTION OVERVIEW

| Project | Tables | Est. Rows | Storage | RLS Complexity |
|---------|--------|-----------|---------|----------------|
| **Identity** | 35 | 1-10M | ~500MB | HIGH |
| **Core** | 65 | 100M-1B | ~50GB | MEDIUM |
| **Wallet** | 38 | 10-100M | ~10GB | HIGH |
| **TOTAL** | **138** | **~1B+** | **~60GB** | - |

---

## 🔐 IDENTITY PROJECT (35 tables)

**Database**: `xeevia_identity`  
**Service Role**: Restricted to auth/identity domain  
**RLS**: STRICT - Users can only see their own records

### Authentication & Account (12 tables)
```
1. profiles ⭐
   ├── Columns: id, email, username, phone, avatar_id
   ├── Rows: ~1M users
   ├── Indexes: email, username
   ├── RLS: users can see own profile + public profiles (if !is_private)
   └── Foreign Keys: auth.users(id)

2. auth.users (Supabase Managed)
   ├── Managed by Supabase Auth
   ├── Columns: id, email, encrypted_password, email_confirmed_at
   ├── Rows: ~1M
   └── RLS: Supabase managed

3. verify_email_tokens ⭐
   ├── Columns: token, email, expires_at
   ├── Rows: ~100K (short-lived)
   ├── Indexes: email, expires_at
   ├── Purpose: Email verification flow
   └── RLS: Service role only

4. password_reset_tokens ⭐
   ├── Columns: token, user_id, expires_at
   ├── Rows: ~50K (short-lived)
   ├── Purpose: Forgot password flow
   └── RLS: Service role only

5. user_recovery_phrases ⭐
   ├── Columns: user_id, phrase_encoded, phrase_hash
   ├── Rows: ~1M
   ├── Purpose: Account recovery
   ├── Encryption: Use TWO_FA_ENCRYPTION_KEY
   └── RLS: User can see own only

6. user_sessions ⭐
   ├── Columns: user_id, session_token, refresh_token, expires_at
   ├── Rows: ~10M (active sessions)
   ├── Purpose: Session management
   ├── Indexes: session_token, user_id
   └── RLS: User can see own sessions only

7. invite_codes ⭐
   ├── Columns: code, type, max_uses, uses_count, expires_at
   ├── Rows: ~100K
   ├── Indexes: code, status
   ├── Purpose: Invite system
   └── RLS: Public read, auth write

8. invite_code_usage ⭐
   ├── Columns: invite_code_id, code, used_by, used_at
   ├── Rows: ~500K
   ├── Purpose: Track invite usage
   └── RLS: Admin can see all

9. waitlist_entries ⭐
   ├── Columns: user_id, invite_code_id, status, reviewed_at
   ├── Rows: ~100K
   ├── Purpose: Early access management
   └── RLS: User sees own, admin sees all

10. blocked_ips ⭐
    ├── Columns: ip, reason, blocked_at, expires_at
    ├── Rows: ~10K
    ├── Purpose: Security
    └── RLS: Admin only

11. platform_freeze ⭐
    ├── Columns: region, is_frozen, frozen_reason
    ├── Rows: ~5-10
    ├── Purpose: Emergency stop
    └── RLS: Admin only

12. audit_logs ⭐
    ├── Columns: admin_id, action, target_type, details, ip
    ├── Rows: ~10M
    ├── Purpose: Admin audit trail
    └── RLS: Admin only
```

### Security & MFA (9 tables)
```
13. two_factor_auth ⭐
    ├── Columns: user_id, secret, enabled, backup_codes, verified_at
    ├── Rows: ~100K users with 2FA
    ├── Purpose: TOTP secrets
    ├── Encryption: Encrypt secret with TWO_FA_ENCRYPTION_KEY
    └── RLS: User can see own only

14. device_fingerprints ⭐
    ├── Columns: user_id, fingerprint_hash, device_name, browser, os
    ├── Rows: ~10M (users have multiple devices)
    ├── Purpose: Device recognition
    ├── Indexes: user_id, fingerprint_hash
    └── RLS: User can see own only

15. trusted_devices ⭐
    ├── Columns: user_id, device_fingerprint_id, device_name, expires_at
    ├── Rows: ~5M
    ├── Purpose: Skip MFA on trusted devices
    ├── Foreign Keys: device_fingerprints(id)
    └── RLS: User can see own only

16. security_events ⭐
    ├── Columns: user_id, event_type, severity, ip_address, device_fingerprint
    ├── Rows: ~100M (high volume)
    ├── Purpose: Login/auth audit trail
    ├── Indexes: user_id, created_at, event_type
    └── RLS: User can see own, admin can see all

17. rate_limits ⭐
    ├── Columns: user_id, ip_address, action_type, action_count, window_start
    ├── Rows: ~1M (rolling window)
    ├── Purpose: Brute force protection
    ├── TTL: Delete records > 24h old (cron job)
    └── RLS: Service role only

18. verification_codes ⭐
    ├── Columns: email, code_hash, code_type, expires_at, attempts
    ├── Rows: ~100K (short-lived)
    ├── Purpose: Email/phone verification, password reset
    ├── Indexes: email, code_type
    └── RLS: Service role only

19. mfa_recovery_codes ⭐
    ├── Columns: user_id, code_hash, used_at, backup_index
    ├── Rows: ~10M (16 codes per user with 2FA)
    ├── Purpose: Backup 2FA codes
    ├── Hashed: Use bcrypt for code_hash
    └── RLS: User can see own only

20. session_invalidations ⭐
    ├── Columns: user_id, reason, invalidated_at
    ├── Rows: ~1M (when user logs out)
    ├── Purpose: Force logout across devices
    └── RLS: User can see own, admin all

21. login_attempts ⭐
    ├── Columns: email, ip_address, success, attempted_at
    ├── Rows: ~100M (audit trail)
    ├── Purpose: Brute force detection
    ├── TTL: Delete > 90 days old
    └── RLS: Admin only
```

### Social Connections (9 tables)
```
22. follows ⭐
    ├── Columns: follower_id, following_id, created_at, blocked_at
    ├── Rows: ~100M (social graph)
    ├── Indexes: follower_id, following_id
    ├── Constraint: follower_id ≠ following_id
    └── RLS: Public read, auth write

23. blocked_users ⭐
    ├── Columns: user_id, blocked_user_id, created_at
    ├── Rows: ~5M
    ├── Purpose: User blocking
    └── RLS: User can see own only

24. connections ⭐
    ├── Columns: user_id, platform, platform_user_id, access_token_encrypted
    ├── Rows: ~10M (users connected to X, TikTok, etc)
    ├── Purpose: OAuth token storage
    ├── Encryption: Encrypt access_token with AES-GCM
    └── RLS: User can see own only

25. connection_logs ⭐
    ├── Columns: connection_id, event_type, status, error_message, logged_at
    ├── Rows: ~100M
    ├── Purpose: Sync & verification audit
    └── RLS: Admin only

26. oauth_clients (NEW) ⭐
    ├── Columns: client_id, client_secret_hash, redirect_uris, owner_id
    ├── Rows: ~10K (external apps)
    ├── Purpose: XEEVIA as OAuth provider
    ├── Indexes: client_id
    └── RLS: Owner can see own, admin can see all

27. oauth_codes (NEW) ⭐
    ├── Columns: code, client_id, user_id, code_challenge, expires_at
    ├── Rows: ~100K (short-lived)
    ├── Purpose: Authorization codes
    ├── TTL: Delete > 10min old
    └── RLS: Service role only

28. oauth_tokens (NEW) ⭐
    ├── Columns: token_id, client_id, user_id, access_token, refresh_token
    ├── Rows: ~1M (active tokens)
    ├── Purpose: OAuth access tokens
    ├── Indexes: access_token, user_id
    └── RLS: Service role only, logged audit

29. oauth_consent (NEW) ⭐
    ├── Columns: user_id, client_id, scopes, granted_at
    ├── Rows: ~1M
    ├── Purpose: Track OAuth permissions
    └── RLS: User can see own only

30. oauth_revocations ⭐
    ├── Columns: token_id, revoked_at, reason
    ├── Rows: ~100K
    ├── Purpose: Token revocation history
    └── RLS: Admin only
```

### Compliance & Audit (5 tables)
```
31. platform_settings ⭐
    ├── Columns: key, value (JSON), updated_at, updated_by
    ├── Rows: ~100
    ├── Purpose: Global app settings
    ├── Example Keys: ngn_rate, paywall_config, feature_flags
    └── RLS: Admin only

32. notification_preferences ⭐
    ├── Columns: user_id, target_user_id, notify_posts, notify_stories, etc
    ├── Rows: ~100M (sparse - only explicit prefs)
    ├── Purpose: User notification settings
    └── RLS: User can see own only

33. admin_team ⭐
    ├── Columns: user_id, email, full_name, role, permissions, status
    ├── Rows: ~50-100
    ├── Purpose: Admin user management
    ├── Roles: ceo_owner, a_admin, b_admin, super_admin, admin, support
    └── RLS: Admin only, CEO override

34. role_permissions (NEW)
    ├── Columns: role, permission, created_at
    ├── Rows: ~100
    ├── Purpose: RBAC matrix
    └── RLS: Admin only

35. system_logs ⭐
    ├── Columns: level (info/warn/error), service, message, stack_trace
    ├── Rows: ~100M
    ├── Purpose: System error tracking
    ├── TTL: Delete > 30 days old
    └── RLS: Admin only
```

---

## 📱 CORE PROJECT (65 tables)

**Database**: `xeevia_core`  
**Service Role**: Content & community domain  
**RLS**: MEDIUM - Users see published content + their own data

### Content Creation (9 tables)
```
36. posts ⭐
    ├── Columns: id, user_id, content, image_ids, video_ids, category
    ├── Rows: ~1B (high volume)
    ├── Indexes: user_id, created_at, category
    ├── Purpose: Feed posts
    ├── Partitioning: By month (posts_2024_01, posts_2024_02, etc)
    └── RLS: Users see published or own

37. reels ⭐
    ├── Columns: id, user_id, video_id, caption, music, duration
    ├── Rows: ~500M
    ├── Indexes: user_id, created_at
    ├── Purpose: Short videos
    ├── Partitioning: By month
    └── RLS: Users see published

38. stories ⭐
    ├── Columns: id, user_id, title, preview, full_content, cover_image_id
    ├── Rows: ~100M
    ├── Purpose: Long-form content
    ├── Unlocking: Paid feature (EP cost)
    └── RLS: Users see published, unlock to read

39. comments ⭐
    ├── Columns: id, user_id, post_id, reel_id, story_id, parent_id, text
    ├── Rows: ~500M
    ├── Indexes: user_id, (post_id, created_at), (reel_id, created_at)
    ├── Purpose: Threaded comments
    ├── Partitioning: By month
    └── RLS: Users see on published content

40. drafts ⭐
    ├── Columns: id, user_id, content_type, title, last_edited
    ├── Rows: ~10M (only unpublished)
    ├── Purpose: Save-as-you-go
    ├── TTL: Delete > 90 days old
    └── RLS: User can see own only

41. sounds ⭐
    ├── Columns: id, name, first_used_by, total_uses, is_trending
    ├── Rows: ~100K
    ├── Purpose: Trending audio
    ├── Indexes: is_trending, total_uses
    └── RLS: Public read only

42. upload_rate_limits ⭐
    ├── Columns: user_id, upload_type, upload_count, window_start
    ├── Rows: ~1M (rolling window)
    ├── Purpose: Prevent spam uploads
    ├── TTL: Delete > 24h old
    └── RLS: Service role only

43. shares ⭐
    ├── Columns: id, content_type, content_id, user_id, share_type
    ├── Rows: ~100M
    ├── Purpose: Share tracking
    ├── Indexes: content_id, share_type
    └── RLS: Admin can see analytics

44. saved_content ⭐
    ├── Columns: id, user_id, content_type, content_id, folder
    ├── Rows: ~100M
    ├── Purpose: Bookmarks/collections
    ├── Indexes: user_id, content_type
    └── RLS: User can see own only
```

### Social Interactions (5 tables)
```
45. post_likes ⭐
    ├── Columns: id, post_id, user_id, created_at
    ├── Rows: ~1B
    ├── Indexes: post_id, user_id (composite)
    ├── Constraint: UNIQUE (post_id, user_id)
    └── RLS: Public read only

46. reel_likes ⭐
    ├── Columns: id, reel_id, user_id, created_at
    ├── Rows: ~500M
    ├── Constraint: UNIQUE (reel_id, user_id)
    └── RLS: Public read only

47. story_likes ⭐
    ├── Columns: id, story_id, user_id, created_at
    ├── Rows: ~100M
    ├── Constraint: UNIQUE (story_id, user_id)
    └── RLS: Public read only

48. comment_likes ⭐
    ├── Columns: id, comment_id, user_id, created_at
    ├── Rows: ~100M
    ├── Constraint: UNIQUE (comment_id, user_id)
    └── RLS: Public read only

49. unlocked_stories ⭐
    ├── Columns: id, story_id, user_id, created_at
    ├── Rows: ~10M
    ├── Purpose: Track who unlocked which stories
    ├── Constraint: UNIQUE (story_id, user_id)
    └── RLS: User can see own, creator sees all
```

### Communities (6 tables)
```
50. communities ⭐
    ├── Columns: id, name, description, owner_id, avatar_id, is_private
    ├── Rows: ~1M
    ├── Indexes: name, owner_id, created_at
    ├── Purpose: Social groups
    ├── Constraint: name length 3-100
    └── RLS: Public see published, members see private

51. community_members ⭐
    ├── Columns: id, community_id, user_id, role_id, joined_at, is_online
    ├── Rows: ~100M (many users per community)
    ├── Indexes: community_id, user_id
    ├── Constraint: UNIQUE (community_id, user_id)
    ├── Purpose: Membership tracking
    └── RLS: Members can see own, leaders see all

52. community_roles ⭐
    ├── Columns: id, community_id, name, color, position, permissions
    ├── Rows: ~10M (avg 10 roles per 1M communities)
    ├── Purpose: RBAC for communities
    ├── Default Roles: owner, admin, moderator, member
    └── RLS: Members can see, leaders modify

53. community_channels ⭐
    ├── Columns: id, community_id, name, icon, type, is_private
    ├── Rows: ~10M (avg 10 channels per community)
    ├── Purpose: Discussion organization
    ├── Types: text, voice, announcement
    └── RLS: Members see public, role checks for private

54. community_messages ⭐
    ├── Columns: id, channel_id, user_id, content, reply_to_id, attachments
    ├── Rows: ~1B
    ├── Indexes: channel_id, user_id, created_at
    ├── Purpose: Community chat
    ├── Partitioning: By month
    └── RLS: Members can see in accessible channels

55. community_invites ⭐
    ├── Columns: id, community_id, code, created_by, max_uses, uses, expires_at
    ├── Rows: ~100K
    ├── Purpose: Community access codes
    ├── Indexes: code, community_id
    └── RLS: Leaders can see, public can use
```

### Messaging (7 tables)
```
56. conversations ⭐
    ├── Columns: id, user1_id, user2_id, last_message_at, updated_at
    ├── Rows: ~100M (order is canonical)
    ├── Indexes: user1_id, user2_id (both directions)
    ├── Purpose: 1-on-1 message threading
    ├── Constraint: UNIQUE (LEAST(user1_id), GREATEST(user2_id))
    └── RLS: Participants only

57. messages ⭐
    ├── Columns: id, conversation_id, sender_id, content, media_url, read
    ├── Rows: ~1B
    ├── Indexes: conversation_id, sender_id, created_at
    ├── Purpose: Message storage
    ├── Partitioning: By month
    └── RLS: Conversation participants only

58. message_reactions ⭐
    ├── Columns: id, message_id, user_id, emoji, created_at
    ├── Rows: ~100M
    ├── Constraint: UNIQUE (message_id, user_id, emoji)
    └── RLS: Conversation participants only

59. message_reads ⭐
    ├── Columns: id, message_id, user_id, read_at
    ├── Rows: ~2B
    ├── Purpose: Read receipts
    ├── Indexes: message_id, user_id
    └── RLS: Conversation participants only

60. deleted_messages ⭐
    ├── Columns: id, message_id, user_id, deleted_at
    ├── Rows: ~100M
    ├── Purpose: Soft-delete tracking
    ├── TTL: Delete > 30 days old
    └── RLS: Admin only

61. hidden_conversations ⭐
    ├── Columns: id, conversation_id, user_id, hidden_at
    ├── Rows: ~10M
    ├── Purpose: User can hide conversations
    ├── Constraint: UNIQUE (conversation_id, user_id)
    └── RLS: User can see own only

62. group_chats (NEW)
    ├── Columns: id, name, icon, created_by, member_ids (array), created_at
    ├── Rows: ~10M
    ├── Purpose: Group messaging (not communities)
    ├── Max Members: 100
    └── RLS: Members only
```

### Notifications (4 tables)
```
63. notifications ⭐
    ├── Columns: id, recipient_user_id, actor_user_id, type, entity_id, message
    ├── Rows: ~1B
    ├── Indexes: recipient_user_id, created_at
    ├── Purpose: In-app notifications
    ├── Partitioning: By month
    ├── Types: like, comment, follow, mention, payment_confirmed, etc
    └── RLS: User can see own only

64. push_subscriptions ⭐
    ├── Columns: id, user_id, endpoint, p256dh, auth, is_active
    ├── Rows: ~10M
    ├── Purpose: Web push device tokens
    ├── Indexes: user_id
    └── RLS: User can see own only

65. push_notifications ⭐
    ├── Columns: id, title, body, target_type, target_ids, sent_by, reach
    ├── Rows: ~10M
    ├── Purpose: Campaign tracking
    ├── Target Types: all, vip, pro, region, specific
    └── RLS: Admin only

66. notification_badge_state ⭐
    ├── Columns: user_id, badge_cleared_at, updated_at
    ├── Rows: ~1M
    ├── Purpose: Badge clear timestamp
    └── RLS: User can see own only
```

### Live Streaming (4 tables)
```
67. live_sessions ⭐
    ├── Columns: id, user_id, title, category, livekit_room, cf_stream_uid
    ├── Rows: ~1M
    ├── Purpose: Stream metadata
    ├── Indexes: user_id, status, created_at
    └── RLS: Creator + viewers during stream

68. stream_viewers ⭐
    ├── Columns: id, session_id, user_id, joined_at, last_seen
    ├── Rows: ~100M
    ├── Purpose: Viewer presence
    ├── Constraint: UNIQUE (session_id, user_id)
    └── RLS: Creator can see, users see own

69. stream_usage_logs ⭐
    ├── Columns: id, user_id, session_id, minutes_used, was_recording
    ├── Rows: ~10M
    ├── Purpose: Billing tracking
    └── RLS: User can see own, admin all

70. stream_tier_limits ⭐
    ├── Columns: tier, minutes_per_month, can_record, max_quality
    ├── Rows: ~7 (one per tier)
    ├── Purpose: Feature limits
    ├── Tiers: free, silver, gold, diamond
    └── RLS: Public read only
```

### News & Discovery (5 tables)
```
71. news_posts ⭐
    ├── Columns: id, title, description, source_name, article_url, category
    ├── Rows: ~10M
    ├── Indexes: category, published_at, source_name
    ├── Purpose: External news aggregation
    ├── Categories: global, africa, crypto, agriculture
    └── RLS: Public read only

72. news_bookmarks ⭐
    ├── Columns: id, user_id, news_id, created_at
    ├── Rows: ~100M
    ├── Purpose: News favorites
    └── RLS: User can see own only

73. news_reactions ⭐
    ├── Columns: id, user_id, news_id, reaction, created_at
    ├── Rows: ~100M
    ├── Reactions: like, fire, sad, wow, angry
    └── RLS: Public read only

74. news_comments ⭐
    ├── Columns: id, news_id, user_id, parent_id, content, likes
    ├── Rows: ~100M
    ├── Purpose: Discussion on news
    └── RLS: Public read only

75. news_fetch_log ⭐
    ├── Columns: id, source_name, articles_found, articles_inserted, fetched_at
    ├── Rows: ~100K
    ├── Purpose: Fetch audit trail
    ├── TTL: Delete > 90 days old
    └── RLS: Admin only
```

### Status & Presence (2 tables)
```
76. status_updates ⭐
    ├── Columns: id, user_id, text, bg, image_id, expires_at
    ├── Rows: ~10M
    ├── Purpose: 24h story-like status
    ├── TTL: Delete > 24h old (cron)
    └── RLS: User can create own, public can see

77. status_likes ⭐
    ├── Columns: id, status_id, user_id, created_at
    ├── Rows: ~100M
    ├── Purpose: Status engagement
    └── RLS: Public read only
```

### Backup Tables (4 tables)
```
78. posts_backup ⭐
    └── Columns: Snapshot of posts for recovery
79. reels_backup ⭐
    └── Columns: Snapshot of reels for recovery
80. stories_backup ⭐
    └── Columns: Snapshot of stories for recovery
81. profiles_backup ⭐
    └── Columns: Snapshot of profiles for recovery
```

### Evidence & Records (2 tables)
```
82. xrc_records ⭐
    ├── Columns: record_id, stream_type, previous_hash, record_hash, actor_id
    ├── Rows: ~100M
    ├── Purpose: Immutable activity log (XRC)
    ├── Stream Types: XTRC, XERC, XARC, XCRC, XPRC, XSRC, XWRC
    ├── Indexes: actor_id, stream_type, created_at
    └── RLS: Public read (evidence is public)

83. xrc_root_chain ⭐
    ├── Columns: stream_type, current_head_hash, last_record_id, record_count
    ├── Rows: ~7 (one per stream type)
    ├── Purpose: XRC chain head
    └── RLS: Public read only
```

### Calls & VoIP (1 table)
```
84. call_logs ⭐
    ├── Columns: id, caller_id, callee_id, type, status, duration_secs
    ├── Rows: ~100M
    ├── Purpose: Call history
    ├── Types: audio, video, group, group-video
    ├── Partitioning: By month
    └── RLS: Participants + admin
```

### Comments & Reports (3 tables)
```
85. comment_reports ⭐
    ├── Columns: id, comment_id, reporter_id, reason, created_at
    ├── Rows: ~1M
    ├── Purpose: Report moderation
    └── RLS: Reporter can see own, mods see all

86. support_cases ⭐
    ├── Columns: id, title, description, user_id, category, status
    ├── Rows: ~100K
    ├── Purpose: Support tickets
    └── RLS: User sees own, support sees assigned/all

87. support_messages ⭐
    ├── Columns: id, ticket_id, user_id, content, is_staff
    ├── Rows: ~1M
    ├── Purpose: Support conversation
    └── RLS: Participants + support staff

88. support_tickets ⭐
    ├── Columns: id, user_id, subject, category, status, priority
    ├── Rows: ~1M
    ├── Purpose: Ticket management
    └── RLS: User sees own, support sees assigned
```

### Active Calls (1 table)
```
89. active_calls
    ├── Columns: id, caller_id, callee_ids (array), status, created_at
    ├── Rows: ~100K (active during calls)
    ├── Purpose: Real-time call state
    ├── TTL: Delete > 24h old
    └── RLS: Participants only
```

### Admin (1 table)
```
90. audit_log
    ├── Columns: id, admin_id, action, target_type, target_id, details
    ├── Rows: ~100M
    ├── Purpose: Admin action audit
    ├── Partitioning: By month
    └── RLS: Admin only
```

---

## 💳 WALLET PROJECT (38 tables)

**Database**: `xeevia_wallet`  
**Service Role**: Payments & financial  
**RLS**: STRICT - Each user only sees own transactions

### Wallet & Balance (4 tables)
```
91. wallets ⭐
    ├── Columns: id, user_id, xev_tokens, engagement_points, paywave_balance
    ├── Rows: ~1M (one per user)
    ├── Constraint: UNIQUE user_id
    ├── Purpose: Main wallet record
    └── RLS: User can see own only

92. wallet_addresses ⭐
    ├── Columns: id, user_id, chain, address, public_key
    ├── Rows: ~10M (users have multi-chain wallets)
    ├── Chains: evm, cardano, solana, tron
    ├── Indexes: user_id, address
    └── RLS: User can see own only

93. wallet_history ⭐
    ├── Columns: id, wallet_id, user_id, change_type, amount, balance_before
    ├── Rows: ~1B (one row per transaction)
    ├── Purpose: Complete ledger
    ├── Indexes: wallet_id, user_id, created_at
    ├── Partitioning: By month
    ├── Immutable: No updates, only inserts
    └── RLS: User can see own only

94. ep_dashboard ⭐
    ├── Columns: id, user_id, total_ep_earned, daily_ep, weekly_ep
    ├── Rows: ~1M
    ├── Purpose: EP summary
    ├── Updated: Daily by cron job
    └── RLS: User can see own only
```

### Transactions (3 tables)
```
95. transactions ⭐
    ├── Columns: id, from_user_id, to_user_id, amount, type, status
    ├── Rows: ~1B
    ├── Purpose: All value transfers
    ├── Types: unlock_story, tip, reward, purchase, withdrawal, deposit, etc
    ├── Statuses: pending, completed, failed, cancelled, refunded
    ├── Indexes: from_user_id, to_user_id, created_at
    ├── Partitioning: By month
    └── RLS: Users see own (as from or to), admin all

96. ep_transactions ⭐
    ├── Columns: id, user_id, amount, balance_after, type, reason
    ├── Rows: ~1B (high volume - every EP change)
    ├── Purpose: EP ledger
    ├── Types: purchase_grant, invite_grant, spend, refund, expiry
    ├── Immutable: No updates
    ├── Partitioning: By month
    └── RLS: User can see own only

97. ep_treasury ⭐
    ├── Columns: id, partition, balance, total_received, total_disbursed
    ├── Rows: ~5 (operations, growth, xev_rewards, reserve, unallocated)
    ├── Purpose: Platform treasury
    ├── Partitions: operations, growth, xev_rewards, reserve, unallocated
    └── RLS: Admin only
```

### Payments (4 tables)
```
98. payments ⭐
    ├── Columns: id, user_id, provider, provider_payment_id, amount_cents
    ├── Rows: ~100M
    ├── Purpose: Complete payment history
    ├── Providers: stripe, paystack, opay, flutterwave, web3
    ├── Statuses: pending, processing, completed, failed, refunded, disputed
    ├── Indexes: user_id, provider, created_at
    ├── Partitioning: By month
    └── RLS: User can see own only

99. payment_products ⭐
    ├── Columns: id, name, description, type, tier, amount_usd
    ├── Rows: ~100
    ├── Purpose: Subscription/product definitions
    ├── Types: one_time, subscription
    ├── Tiers: whitelist, standard, pro, vip
    └── RLS: Public read only

100. payment_intents ⭐
     ├── Columns: id, user_id, product_id, provider, status, expires_at
     ├── Rows: ~10M
     ├── Purpose: Temporary checkout state
     ├── TTL: Delete > 1h old (cron)
     └── RLS: User can see own only

101. webhook_events ⭐
     ├── Columns: id, provider, event_id, event_type, payload, verified
     ├── Rows: ~1B
     ├── Purpose: Idempotent webhook processing
     ├── Indexes: event_id, payment_id, processed
     ├── TTL: Delete > 30 days old
     └── RLS: Admin only
```

### Subscriptions (2 tables)
```
102. subscriptions ⭐
      ├── Columns: id, user_id, product_id, provider_sub_id, status
      ├── Rows: ~5M
      ├── Purpose: Active subscriptions
      ├── Statuses: active, past_due, canceled, trialing
      ├── Indexes: user_id, status
      └── RLS: User can see own only

103. ep_treasury_config ⭐
      ├── Columns: id, protocol_fee_pct, operations_pct, growth_pct
      ├── Rows: ~1
      ├── Purpose: Treasury allocation rules
      └── RLS: Admin only
```

### Payment Methods (2 tables)
```
104. user_cards ⭐
      ├── Columns: id, user_id, card_type, last_four, brand, balance
      ├── Rows: ~10M
      ├── Card Types: virtual, external
      ├── Brands: Visa, Mastercard, Verve
      ├── Purpose: Saved payment methods
      └── RLS: User can see own only

105. billing_addresses (NEW)
      ├── Columns: id, user_id, address, city, country, postal_code
      ├── Rows: ~5M
      ├── Purpose: Billing address for payments
      └── RLS: User can see own only
```

### Financial Products (3 tables)
```
106. staking_positions ⭐
      ├── Columns: id, user_id, amount, duration_days, rate_pct, status
      ├── Rows: ~10M
      ├── Purpose: Staking/yield products
      ├── Durations: 30, 90, 180, 365 days
      ├── Indexes: user_id, matures_at
      └── RLS: User can see own only

107. savings_plans ⭐
      ├── Columns: id, user_id, plan_type, plan_name, amount, balance
      ├── Rows: ~5M
      ├── Plan Types: goal, lock, flex
      ├── Purpose: Savings accounts
      └── RLS: User can see own only

108. investment_accounts (NEW)
      ├── Columns: id, user_id, account_type, balance, created_at
      ├── Rows: ~1M
      ├── Purpose: Investment tracking
      └── RLS: User can see own only
```

### Web3 & Blockchain (5 tables)
```
109. web3_payments ⭐
      ├── Columns: id, user_id, chain_id, tx_hash, contract_address, amount
      ├── Rows: ~100M
      ├── Purpose: On-chain transaction tracking
      ├── Chains: Polygon, Base, Solana, Arbitrum, Ethereum, BSC
      ├── Indexes: user_id, tx_hash, created_at
      ├── Partitioning: By month
      └── RLS: User can see own only

110. blockchain_transactions ⭐
      ├── Columns: id, user_id, chain, tx_hash, status, block_number
      ├── Rows: ~500M
      ├── Purpose: Detailed chain tracking
      ├── Statuses: pending, confirmed, failed
      └── RLS: User can see own only

111. contract_interactions ⭐
      ├── Columns: id, user_id, contract_address, method, parameters, tx_hash
      ├── Rows: ~100M
      ├── Purpose: DeFi interactions
      └── RLS: User can see own only

112. wallet_verification ⭐
      ├── Columns: id, user_id, wallet_address, signature, verified_at
      ├── Rows: ~10M
      ├── Purpose: Proof of ownership
      ├── Indexes: wallet_address
      └── RLS: User can see own only

113. oracle_results ⭐
      ├── Columns: id, oracle_id, price_feed, latest_price, updated_at
      ├── Rows: ~100K (one per asset per hour)
      ├── Purpose: Price feeds
      └── RLS: Public read only
```

### Rewards & Incentives (5 tables)
```
114. reward_pools ⭐
      ├── Columns: id, week_start, week_end, total_revenue, silver_pool
      ├── Rows: ~500 (one per week)
      ├── Purpose: Weekly reward distribution
      └── RLS: Admin only

115. reward_level_history ⭐
      ├── Columns: id, user_id, old_level, new_level, reason, criteria_met
      ├── Rows: ~10M
      ├── Purpose: Tier progression tracking
      ├── Levels: none, silver, gold, diamond
      └── RLS: User can see own only

116. profile_boosts ⭐
      ├── Columns: id, user_id, boost_tier, billing, price_usd, expires_at
      ├── Rows: ~5M
      ├── Tiers: silver, gold, diamond
      ├── Billings: monthly, yearly
      ├── Purpose: Premium features
      └── RLS: User can see own only

117. boost_ep_prices ⭐
      ├── Columns: tier, billing, ep_cost, ep_bonus_pct, usd_equiv
      ├── Rows: ~6 (3 tiers × 2 billings)
      ├── Purpose: Pricing matrix
      └── RLS: Public read only

118. daily_task_completions ⭐
      ├── Columns: id, user_id, task_id, completed_at, count
      ├── Rows: ~1B (high volume)
      ├── Purpose: Daily challenge tracking
      ├── TTL: Delete > 1 year old
      ├── Partitioning: By month
      └── RLS: User can see own only
```

### Gift Cards (1 table)
```
119. gift_cards ⭐
      ├── Columns: id, code, tier, value_ep, price_usd, sender_id, recipient_id
      ├── Rows: ~10M
      ├── Purpose: Gift card marketplace
      ├── Statuses: unused, sent, redeemed, expired
      ├── Tiers: silver, gold, blue_diamond, red_diamond, black_diamond
      └── RLS: User can see own (sent or received)
```

### Platform Revenue (2 tables)
```
120. platform_revenue ⭐
      ├── Columns: id, amount, user_id, source, metadata, created_at
      ├── Rows: ~1B
      ├── Purpose: Revenue tracking
      ├── Sources: purchases, subscriptions, royalties, tips, etc
      ├── Indexes: source, created_at
      ├── Partitioning: By month
      └── RLS: Admin only

121. platform_settings
      ├── Columns: key, value (JSON), updated_at
      ├── Rows: ~100 (shared across projects)
      ├── Purpose: Platform-wide config
      ├── Example Keys: ngn_rate, paywall_config, withdrawal_limits
      └── RLS: Admin only
```

### Scholarships (1 table)
```
122. scholarship_applications ⭐
      ├── Columns: id, user_id, tier, full_name, institution, course
      ├── Rows: ~100K
      ├── Purpose: Student scholarship program
      ├── Tiers: quarter (25%), half (50%), full (100%)
      ├── Statuses: pending, under_review, approved, rejected, disbursed
      └── RLS: User can see own, admin sees all
```

### Compliance (2 tables)
```
123. kyc_records (NEW)
      ├── Columns: id, user_id, verification_level, verified_at, expires_at
      ├── Rows: ~1M
      ├── Purpose: KYC/AML tracking
      ├── Levels: none, basic, verified, enhanced
      └── RLS: User can see own, admin sees all

124. aml_flags (NEW)
      ├── Columns: id, user_id, flag_type, reason, flagged_at, resolved_at
      ├── Rows: ~10K
      ├── Purpose: AML alerts
      └── RLS: Admin only
```

### Backup (1 table)
```
125. payment_receipts_archive ⭐
      ├── Columns: id, payment_id, receipt_url, archived_at
      ├── Rows: ~100M
      ├── Purpose: PDF receipts
      ├── TTL: Delete > 7 years old
      └── RLS: User can see own only
```

### Admin (3 tables)
```
126. frozen_accounts (NEW)
      ├── Columns: user_id, reason, frozen_at, frozen_by
      ├── Rows: ~100K
      ├── Purpose: Account suspension
      └── RLS: Admin only

127. transaction_disputes (NEW)
      ├── Columns: id, transaction_id, user_id, reason, status
      ├── Rows: ~100K
      ├── Purpose: Dispute management
      └── RLS: User can see own, admin all

128. platform_freeze ⭐
      ├── Columns: region, is_frozen, frozen_by, frozen_reason
      ├── Rows: ~10
      ├── Purpose: Emergency system pause
      └── RLS: Admin only
```

---

## 📋 MIGRATION SEQUENCE

**Recommended Order** (within each project):

### Identity Project
1. ✅ profiles (dependency for all)
2. ✅ two_factor_auth
3. ✅ device_fingerprints
4. ✅ trusted_devices
5. ✅ security_events
6-35. Other identity tables

### Core Project
1. ✅ posts (high volume first)
2. ✅ reels
3. ✅ stories
4. ✅ comments
5. ✅ All likes tables
6-65. Other content tables

### Wallet Project
1. ✅ wallets (dependency)
2. ✅ transactions
3. ✅ payments
4. ✅ wallet_history
5-38. Other wallet tables

---

**Total Migration Effort**:
- **Identity**: ~35 tables | ~1-2 hours
- **Core**: ~65 tables | ~4-6 hours
- **Wallet**: ~38 tables | ~2-3 hours
- **TOTAL**: ~7-11 hours of actual migration work

---

**Next: Start with table schema migration in Phase 1?** ✅
