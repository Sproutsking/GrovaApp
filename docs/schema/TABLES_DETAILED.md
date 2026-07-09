# Database Tables — Detailed Reference

This file maps every table in the Xeevia schema to a concise purpose, the primary key, important columns, and the domain (Identity / Core / Wallet / Evidence / Admin). Use this as the canonical reference for developers and AIs.

Format:
- Table: `table_name` — Domain
  - Primary key: `...`
  - Purpose (one line)
  - Important columns: ...
  - Used by: list of approximate service files or components

---

1. Table: `profiles` — Identity
   - Primary key: `id` (uuid)
   - Purpose: User profile store and identity metadata
   - Important columns: `email`, `username`, `full_name`, `avatar_id`, `verified`, `require_2fa`, `phone`, `phone_verified`, `preferences`, `subscription_tier`, `engagement_points`
   - Used by: `src/services/auth`, profile UI, account settings

2. Table: `wallets` — Wallet
   - Primary key: `id`
   - Purpose: User wallet balances and recovery / pin metadata
   - Important columns: `user_id`, `xev_tokens`, `engagement_points`, `paywave_balance`, `usdt_balance`, `withdrawal_pin_hash`, `recovery_phrase_encrypted`
   - Used by: `src/services/wallet/*`, wallet UI

3. Table: `ep_dashboard` — Wallet / Core
   - Primary key: `id`
   - Purpose: Tracks user's engagement points aggregates
   - Important columns: `user_id`, `total_ep_earned`, `daily_ep`, `weekly_ep`

4. Table: `two_factor_auth` — Identity / Security
   - Primary key: `id`
   - Purpose: Store TOTP secret, enabled flag, backup codes
   - Important columns: `user_id`, `secret`, `enabled`, `backup_codes`, `verified_at`
   - Used by: `src/components/Modals/TwoFactorSetupModal.jsx`, `authService`

5. Table: `device_fingerprints` — Identity / Security
   - Primary key: `id`
   - Purpose: Fingerprint devices for trust scoring & risk
   - Important columns: `user_id`, `fingerprint_hash`, `browser`, `os`, `is_trusted`, `ip_address`

6. Table: `trusted_devices` — Identity / Security
   - Primary key: `id`
   - Purpose: Explicit list of trusted devices (skip MFA)
   - Important columns: `user_id`, `device_name`, `expires_at`, `revoked`

7. Table: `security_events` — Identity / Security / Admin
   - Primary key: `id`
   - Purpose: Audit trail for security-critical events (logins, 2FA actions)
   - Important columns: `user_id`, `event_type`, `severity`, `ip_address`, `device_fingerprint`

8. Table: `rate_limits` — Identity / Security
   - Primary key: `id`
   - Purpose: Rate limiting counters for actions like login_attempt, signup
   - Important columns: `user_id`, `ip_address`, `action_type`, `action_count`, `window_start`

9. Table: `user_sessions` — Identity
   - Primary key: `id`
   - Purpose: Session tokens, refresh tokens, device association
   - Important columns: `user_id`, `session_token`, `refresh_token`, `expires_at`, `is_active`

10. Table: `audit_logs` — Admin
    - Primary key: `id`
    - Purpose: Generic audit logging for data changes
    - Important columns: `user_id`, `action`, `table_name`, `old_data`, `new_data`

11. Table: `posts` — Core / Content
    - Primary key: `id`
    - Purpose: Feed posts content
    - Important columns: `user_id`, `content`, `image_ids`, `video_ids`, `likes`, `comments_count`, `views`, `created_at`
    - Used by: feed components, post editor

12. Table: `stories` — Core / Content
    - Primary key: `id`
    - Purpose: Long-form story content and previews
    - Important columns: `user_id`, `title`, `preview`, `full_content`, `cover_image_id`, `unlock_cost`

13. Table: `reels` — Core / Content
    - Primary key: `id`
    - Purpose: Short video entries
    - Important columns: `user_id`, `video_id`, `video_metadata`, `thumbnail_id`, `duration`, `likes`

14. Table: `comments` — Core
    - Primary key: `id`
    - Purpose: Comments on posts/reels/stories
    - Important columns: `user_id`, `post_id`, `reel_id`, `story_id`, `parent_id`, `text`

15. Table: `post_likes` — Core
    - Primary key: `id`
    - Purpose: Like relation for posts
    - Important columns: `post_id`, `user_id`, `created_at`

16. Table: `story_likes` — Core
    - Primary key: `id`
    - Purpose: Like relation for stories

17. Table: `reel_likes` — Core
    - Primary key: `id`
    - Purpose: Like relation for reels

18. Table: `comment_likes` — Core
    - Primary key: `id`
    - Purpose: Like relation for comments

19. Table: `unlocked_stories` — Core / Payments
    - Primary key: `id`
    - Purpose: Tracks purchases/unlocks of premium story content
    - Important columns: `story_id`, `user_id`, `created_at`

20. Table: `saved_content` — Core
    - Primary key: `id`
    - Purpose: User saved items (posts, reels, stories)
    - Important columns: `user_id`, `content_type`, `content_id`, `folder`

21. Table: `shares` — Core
    - Primary key: `id`
    - Purpose: Sharing records for content distribution

22. Table: `transactions` — Wallet / Payments
    - Primary key: `id`
    - Purpose: Money movement records (deposits, withdrawals, tips)
    - Important columns: `from_user_id`, `to_user_id`, `amount`, `type`, `status`, `metadata`
    - Used by: `src/services/wallet/*`, payment webhook handlers

23. Table: `wallet_history` — Wallet
    - Primary key: `id`
    - Purpose: Ledger of wallet changes
    - Important columns: `wallet_id`, `user_id`, `change_type`, `amount`, `balance_before`, `balance_after`, `transaction_id`

24. Table: `platform_revenue` — Wallet / Finance
    - Primary key: `id`
    - Purpose: Revenue collection records

25. Table: `posts_backup`, `reels_backup`, `stories_backup`, `profiles_backup` — Archive
    - Purpose: Historical backups of content and profiles. Consider moving to `archive` schema.

26. Table: `upload_rate_limits` — Core
    - Primary key: `id`
    - Purpose: Per-user upload quotas and windows

27. Table: `sounds` — Core
    - Primary key: `id`
    - Purpose: Sound library metadata

28. Table: `communities` — Core
    - Primary key: `id`
    - Purpose: Community metadata and settings
    - Important columns: `owner_id`, `member_count`, `settings`

29. Table: `community_roles` — Core
    - Primary key: `id`
    - Purpose: Role templates for community permissions

30. Table: `community_members` — Core
    - Primary key: `id`
    - Purpose: Membership records mapping users to communities

31. Table: `community_channels` — Core
    - Primary key: `id`
    - Purpose: Channels inside communities (text/voice/announcement)

32. Table: `community_messages` — Core / Messaging
    - Primary key: `id`
    - Purpose: Messages inside community channels

33. Table: `community_invites` — Core
    - Primary key: `id`
    - Purpose: Invite codes and limits for joining communities

34. Table: `drafts` — Core
    - Primary key: `id`
    - Purpose: In-progress content drafts (posts, reels, stories)

35. Table: `notification_preferences` — Core
    - Primary key: `id`
    - Purpose: Per-user notification settings for target users

36. Table: `follows` — Core
    - Primary key: `id`
    - Purpose: Follow relationship (follower_id -> following_id)

37. Table: `conversations` — Core / Messaging
    - Primary key: `id`
    - Purpose: One-to-one conversation metadata

38. Table: `messages` — Core / Messaging
    - Primary key: `id`
    - Purpose: Message records inside conversations

39. Table: `deleted_messages` — Core
    - Primary key: `id`
    - Purpose: Soft-delete audit of messages

40. Table: `hidden_conversations` — Core
    - Primary key: `id`
    - Purpose: Per-user hidden conversation flags

41. Table: `message_reactions` — Core
    - Primary key: `id`
    - Purpose: Emoji reactions to messages

42. Table: `message_reads` — Core
    - Primary key: `id`
    - Purpose: Read receipts for messages

43. Table: `verification_codes` — Identity / MFA
    - Primary key: `id`
    - Purpose: One-time codes for email/phone/login/password reset
    - Important columns: `email`, `code_hash`, `code_type`, `expires_at`, `attempts`

44. Table: `push_subscriptions` — Notifications
    - Primary key: `id`
    - Purpose: Web push subscription records (endpoint, p256dh, auth)

45. Table: `notifications` — Core / Notifications
    - Primary key: `id`
    - Purpose: App notification records for recipients

46. Table: `profile_views` — Core
    - Primary key: `id`
    - Purpose: Profile view events for analytics

47. Table: `admin_team` — Admin
    - Primary key: `id`
    - Purpose: Admin accounts and permissions

48. Table: `invite_codes` — Core
    - Primary key: `id`
    - Purpose: Invite code templates and pricing

49. Table: `invite_code_usage` — Core
    - Primary key: `id`
    - Purpose: Usage records for invites

50. Table: `platform_settings` — Admin
    - Primary key: `id`
    - Purpose: Global key-value settings (json)

51. Table: `payment_products` — Wallet
    - Primary key: `id`
    - Purpose: Product catalog for payments/subscriptions

52. Table: `payment_intents` — Wallet
    - Primary key: `id`
    - Purpose: Payment intent tracking and idempotency

53. Table: `payments` — Wallet
    - Primary key: `id`
    - Purpose: Payment records, provider metadata, status, and audit

54. Table: `webhook_events` — Wallet / Integrations
    - Primary key: `id`
    - Purpose: Stored raw webhook payloads for verification and retry

55. Table: `subscriptions` — Wallet
    - Primary key: `id`
    - Purpose: Recurring subscription records and periods

56. Table: `ep_transactions` — Wallet / EP economy
    - Primary key: `id`
    - Purpose: Engagement points ledger

57. Table: `notification_badge_state` — Core
    - Primary key: `user_id`
    - Purpose: Tracks last-cleared badge timestamp per user

58. Table: `support_cases` — Admin / Support
    - Primary key: `id`
    - Purpose: Support ticket header data

59. Table: `support_messages` — Admin / Support
    - Primary key: `id`
    - Purpose: Messages attached to support tickets

60. Table: `platform_freeze` — Admin
    - Primary key: `region`
    - Purpose: Per-region freeze flags for operations

61. Table: `blocked_ips` — Admin / Security
    - Primary key: `ip`
    - Purpose: Blacklist for abusive IPs

62. Table: `push_notifications` — Notifications
    - Primary key: `id`
    - Purpose: Admin push broadcast records

63. Table: `audit_log` — Admin
    - Primary key: `id`
    - Purpose: Admin audit trail for admin actions

64. Table: `support_tickets` — Admin
    - Primary key: `id`
    - Purpose: Support workflow (ticket-level)

65. Table: `support_messages` — Admin
    - Primary key: `id`
    - Purpose: Ticket messages (duplicate table name earlier — ensure single source)

66. Table: `staking_positions` — Wallet
    - Primary key: `id`
    - Purpose: Records of user staking positions and maturity

67. Table: `savings_plans` — Wallet
    - Primary key: `id`
    - Purpose: User savings plan metadata and balances

68. Table: `user_cards` — Wallet
    - Primary key: `id`
    - Purpose: Stored card metadata for user (non-sensitive last4 only)

69. Table: `scholarship_applications` — Core / Admin
    - Primary key: `id`
    - Purpose: Applications for scholarship programs

70. Table: `user_recovery_phrases` — Identity / Security
    - Primary key: `id`
    - Purpose: Encrypted recovery phrases for wallet recovery

71. Table: `xrc_records` — Evidence / XRC
    - Primary key: `record_id`
    - Purpose: Core evidence chain records and payloads

72. Table: `xrc_root_chain` — Evidence
    - Primary key: `stream_type`
    - Purpose: Head pointers and metadata for XRC streams

73. Table: `waitlist_entries` — Core
    - Primary key: `id`
    - Purpose: Waitlist signup & invite tracking

74. Table: `comment_reports` — Core / Moderation
    - Primary key: `id`
    - Purpose: Reports filed against comments

75. Table: `gift_cards` — Wallet
    - Primary key: `id`
    - Purpose: Gift card issuance/redeem records

76. Table: `daily_task_completions` — Core
    - Primary key: `id`
    - Purpose: Track daily completion counts for tasks

77. Table: `profile_boosts` — Wallet / Promotions
    - Primary key: `id`
    - Purpose: Boost purchase & expiry records

78. Table: `reward_pools` — Wallet / Rewards
    - Primary key: `id`
    - Purpose: Weekly reward pools and distribution metadata

79. Table: `reward_level_history` — Core
    - Primary key: `id`
    - Purpose: History of reward level changes for users

80. Table: `live_sessions` — Core / Streaming
    - Primary key: `id`
    - Purpose: Live session records and streaming metadata

81. Table: `stream_usage_logs` — Core
    - Primary key: `id`
    - Purpose: Streaming resource usage and billing metrics

82. Table: `stream_viewers` — Core
    - Primary key: `id`
    - Purpose: Viewer join history for live sessions

83. Table: `stream_tier_limits` — Core
    - Primary key: `tier`
    - Purpose: Limits and capabilities for live stream tiers

84. Table: `boost_ep_prices` — Core / Economy
    - Primary key: `(tier, billing)`
    - Purpose: Pricing table for boosts

85. Table: `status_updates` — Core
    - Primary key: `id`
    - Purpose: ephemeral status posts for users

86. Table: `status_likes` — Core
    - Primary key: `id`
    - Purpose: Likes for status updates

87. Table: `call_logs` — Core / Calls
    - Primary key: `id`
    - Purpose: Call history records (audio/video)

88. Table: `wallet_addresses` — Wallet
    - Primary key: `id`
    - Purpose: On-chain wallet address records for users

89. Table: `news_posts` — Core
    - Primary key: `id`
    - Purpose: Curated news articles displayed in app

90. Table: `news_fetch_log` — Core
    - Primary key: `id`
    - Purpose: Metadata about news fetch operations

91. Table: `news_bookmarks` — Core
    - Primary key: `id`
    - Purpose: Bookmarks for news articles

92. Table: `news_reactions` — Core
    - Primary key: `id`
    - Purpose: Reactions to news posts

93. Table: `news_comments` — Core
    - Primary key: `id`
    - Purpose: Comments on news posts

94. Table: `news_views` — Core
    - Primary key: `id`
    - Purpose: View events for news posts

95. Table: `group_chats` — Core / Messaging
    - Primary key: `id`
    - Purpose: Group messaging channels metadata

96. Table: `active_calls` — Core
    - Primary key: `id`
    - Purpose: Currently active call sessions

97. Table: `ep_treasury` — Wallet / Treasury
    - Primary key: `id`
    - Purpose: Treasury partitions and balances

98. Table: `ep_treasury_config` — Wallet
    - Primary key: `id`
    - Purpose: Distribution percentages and config for treasury

99. Table: `posts_backup` — Archive
    - Purpose: backup of posts (archival)

100. Table: `reels_backup` — Archive

101. Table: `stories_backup` — Archive

102. Table: `profiles_backup` — Archive


---

Notes:
- If a table appears duplicated in the code or schema, ensure a single canonical definition and move older variants to archive.
- For each table above, policies and RLS should be recorded in `docs/schema/` as separate files (per-domain). I can generate per-table RLS recommendation files next.

End of tables reference.
