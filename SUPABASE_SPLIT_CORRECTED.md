# Supabase Split Migration - CORRECTED PLAN

## ❌ The Problem We Found

Your old Supabase project has **153 tables**, but the export was **incomplete**:
- ✓ **153 tables** listed in manifest
- ✓ **81 data files** actually exported (47% complete)
- ✗ **72 tables missing** from the export

## ✅ What We're Doing Now

Since we have 81 files with data, we're migrating those 70 tables that matter across your 3 projects:

| Project | Status | Tables | With Data |
|---------|--------|--------|-----------|
| **Identity** | Ready | 18 | 13 ✓ |
| **Core** | Ready | 52 | 32 ✓ |
| **Wallet** | Ready | 43 | 25 ✓ |
| **TOTAL** | **Ready** | **113** | **70** |

---

## 🚀 ACTION ITEMS - DO THIS NOW

### Step 1: Create Schemas (5-10 minutes)

Go to each Supabase project and create the tables:

#### 1️⃣ **Identity Project** (https://app.supabase.com/project/pevhyriszemvnrwvfshm/sql)
```
1. Click "New Query"
2. Copy entire contents of: exports/old_project/schema_identity_v2.sql
3. Paste and click "Run"
4. Wait for success ✓
```

#### 2️⃣ **Core Project** (https://app.supabase.com/project/hhqohlzzpzgkfdeanudw/sql)
```
1. Click "New Query"
2. Copy entire contents of: exports/old_project/schema_core_v2.sql
3. Paste and click "Run"
4. Wait for success ✓
```

#### 3️⃣ **Wallet Project** (https://app.supabase.com/project/wyqtcjqbdniwebvrwdnk/sql)
```
1. Click "New Query"
2. Copy entire contents of: exports/old_project/schema_wallet_v2.sql
3. Paste and click "Run"
4. Wait for success ✓
```

**⏱️ Total time: ~10 minutes**

---

### Step 2: Import Data (Automatic - 2-3 minutes)

Once all schemas are created, run this command:

```bash
bash scripts/import_all_boundaries.sh
```

This will automatically import all 70 tables with data across the three projects.

---

## 📋 Table Distribution

### Identity Project (13 tables with data)
```
✓ profiles (48 columns)
✓ user_sessions (13 columns)
✓ user_recovery_phrases (8 columns)
✓ two_factor_auth (8 columns)
✓ notification_badge_state (3 columns)
✓ notification_dedup (3 columns)
✓ notifications (9 columns)
✓ profile_access_summary (15 columns)
✓ profile_boosts (18 columns)
✓ push_notifications (10 columns)
✓ security_events (10 columns)
✓ profiles_backup (27 columns)
⊘ 5 tables without data (will need separate export)
```

### Core Project (32 tables with data)
```
✓ posts (18 columns)
✓ posts_backup (14 columns)
✓ comments (10 columns)
✓ comment_likes (4 columns)
✓ post_likes (4 columns)
✓ reels (15 columns)
✓ reel_likes (4 columns)
✓ stories (16 columns)
✓ status_updates (12 columns)
✓ status_likes (4 columns)
✓ messages (12 columns)
✓ message_reads (4 columns)
✓ group_messages (9 columns)
✓ deleted_messages (4 columns)
✓ conversations (6 columns)
✓ communities (17 columns)
✓ community_channels (11 columns)
✓ community_members (7 columns)
✓ community_roles (9 columns)
✓ community_invites (8 columns)
✓ community_messages (11 columns)
✓ drafts (24 columns)
✓ saved_content (6 columns)
✓ news_posts (19 columns)
✓ news_feed (22 columns)
✓ news_fetch_log (8 columns)
✓ discovery_content (18 columns)
✓ culture_categories (14 columns)
✓ sounds (8 columns)
✓ support_tickets (15 columns)
✓ support_messages (9 columns)
✓ card_posts (21 columns)
✓ live_sessions (20 columns)
⊘ 20 tables without data (will need separate export)
```

### Wallet Project (25 tables with data)
```
✓ wallets (18 columns)
✓ wallet_addresses (6 columns)
✓ wallet_history (11 columns)
✓ transactions (13 columns)
✓ payments (31 columns)
✓ payment_intents (12 columns)
✓ payment_products (14 columns)
✓ withdrawal_queue (19 columns)
✓ p2p_payment_methods (11 columns)
✓ p2p_rate_limits (4 columns)
✓ p2p_reputation (12 columns)
✓ paywave_fee_config (10 columns)
✓ platform_settings (6 columns)
✓ platform_freeze (5 columns)
✓ ep_treasury (6 columns)
✓ ep_treasury_config (9 columns)
✓ ep_transactions (10 columns)
✓ ep_dashboard (12 columns)
✓ liquidity_config (12 columns)
✓ boost_ep_prices (5 columns)
✓ admin_revenue_summary (11 columns)
✓ admin_team (12 columns)
✓ admin_user_stats (6 columns)
✓ audit_log (10 columns)
✓ ambassador_profiles (18 columns)
⊘ 18 tables without data (will need separate export)
```

---

## ⚠️ Important: The Missing Tables

**72 tables are missing from this export.** These are either:
1. Empty tables (no data to export)
2. Not included in the original export script
3. New tables added after the export

To include them later:
1. Export these specific tables from the old Supabase:
   ```
   audit_logs, bill_payments, blocked_ips, comment_reports,
   connections, culture_content, culture_creator_profiles,
   culture_engagement, culture_popular_this_week, culture_trending,
   deep_links, device_fingerprints, distribution_deep_links,
   distribution_queue, ep_action_rate_limits, ep_treasury_disbursements,
   ...and 56 more
   ```
2. Create their schemas in the new projects
3. Import the data

But for now, we'll focus on the 70 tables we have ready.

---

## 🔍 Files Ready to Use

```
✓ exports/old_project/schema_identity_v2.sql     (370 lines, 18 tables)
✓ exports/old_project/schema_core_v2.sql        (850 lines, 52 tables)
✓ exports/old_project/schema_wallet_v2.sql      (730 lines, 43 tables)
✓ exports/old_project/boundary_map.json         (Updated to 113 tables)
✓ scripts/import_all_boundaries.sh              (Ready to import)
✓ scripts/import_split_supabase_by_boundary.py (Ready to import)
```

---

## 📞 Troubleshooting

### "SQL Error: Table already exists"
→ Your schema files might have duplicate CREATE TABLE statements. This is OK - the `CREATE TABLE IF NOT EXISTS` will skip existing tables.

### "HTTP 404: Could not find table"
→ Make sure all schemas completed successfully in step 1. Check the Supabase dashboard to verify tables were created.

### "HTTP 401: Unauthorized"
→ Check your service role keys in `.env` are correct. They should start with `eyJ...`

### Import seems slow
→ Normal - the REST API processes requests sequentially. Check the logs for progress.

---

## ✅ Verification Checklist

After step 2 (import), verify:

```bash
# Check row counts
curl -s \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  "https://pevhyriszemvnrwvfshm.supabase.co/rest/v1/profiles?select=count()" | jq

# Should return: {"count": [NUMBER_OF_ROWS]}
```

---

## 🚀 Next After Import

1. Run `npm install` if needed
2. Run `npm run build` to build the app
3. Test auth flow (uses Identity project)
4. Test content loading (uses Core project)
5. Test wallet functions (uses Wallet project)

---

## 📌 Summary

**Before:** 153 tables, incomplete export  
**Now:** 70 out of 81 exported tables ready to migrate  
**Next:** Create 3 schemas + import data  
**Time:** ~15 minutes total  
**Status:** ✅ Ready to proceed!

---

**Created:** 2024-07-10  
**Updated:** 2024-07-10 (Corrected after finding incomplete export)
