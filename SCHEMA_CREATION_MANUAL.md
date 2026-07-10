# Supabase Split Migration - Manual Schema Creation

This guide provides SQL statements to create tables in each Supabase project via the web dashboard.

## Instructions

For each of the three projects below:

1. Go to the Supabase project dashboard
2. Click the **SQL Editor** button in the left sidebar
3. Click **New Query**
4. Copy the SQL from the corresponding file
5. Paste it into the query editor
6. Click **Run** to execute

---

## Identity Project (pevhyriszemvnrwvfshm)

**Project URL:** https://app.supabase.com/project/pevhyriszemvnrwvfshm

**Tables to create:** 12 tables
- profiles
- user_sessions
- user_recovery_phrases
- two_factor_auth
- notification_preferences
- notification_badge_state
- notification_dedup
- security_events
- trusted_devices
- verification_codes
- device_fingerprints
- profile_access_summary

**SQL File:** `exports/old_project/schema_identity.sql`

**Copy the entire contents of this file and run it in the SQL Editor.**

---

## Core Project (hhqohlzzpzgkfdeanudw)

**Project URL:** https://app.supabase.com/project/hhqohlzzpzgkfdeanudw

**Tables to create:** 25 tables
- posts, posts_backup
- comments, comment_likes
- reels, reel_likes
- stories
- status_updates, status_likes
- messages, message_reads
- conversations, community_messages
- communities, community_channels, community_members, community_roles, community_invites
- drafts, saved_content
- news_posts, news_feed
- discovery_content
- sounds, supports

**SQL File:** `exports/old_project/schema_core.sql`

**Copy the entire contents of this file and run it in the SQL Editor.**

---

## Wallet Project (wyqtcjqbdniwebvrwdnk)

**Project URL:** https://app.supabase.com/project/wyqtcjqbdniwebvrwdnk

**Tables to create:** 19 tables
- wallets, wallet_addresses
- wallet_history
- transactions, payments, payment_intents, payment_products
- withdrawal_queue
- p2p_payment_methods, p2p_rate_limits, p2p_reputation
- paywave_fee_config
- platform_settings, platform_freeze
- ep_treasury, ep_treasury_config
- ep_transactions, ep_dashboard
- liquidity_config

**SQL File:** `exports/old_project/schema_wallet.sql`

**Copy the entire contents of this file and run it in the SQL Editor.**

---

## After Creating Tables

Once all three projects have their tables created:

1. Come back and run the data import script:
   ```bash
   IDENTITY_DB_PASSWORD='Krisparinto007' \
   CORE_DB_PASSWORD='Krisparinto007' \
   WALLET_DB_PASSWORD='Krisparinto007' \
   python3 scripts/import_split_supabase_by_boundary.py
   ```

2. Or use the REST API import which is network-accessible from the container.

---

## Alternative: Fast Manual Copy-Paste

All SQL statements are ready in:
- `exports/old_project/schema_identity.sql`
- `exports/old_project/schema_core.sql`
- `exports/old_project/schema_wallet.sql`
- `exports/old_project/schema_all.sql` (all tables combined)

Open each file, copy its contents, and paste into the corresponding project's SQL Editor.
