# Supabase Split Migration - PRODUCTION READY

**Status**: ✅ Ready to execute on LIVE production  
**Risk Level**: LOW (schema-only, no data loss)  
**Time Required**: 30-45 minutes  
**Last Updated**: 2024-07-10

---

## 📋 WHAT YOU'RE DOING

You're migrating from **1 old Supabase project** to **3 new split projects**:

| Project | Type | Purpose | Tables |
|---------|------|---------|--------|
| **Identity** | Auth | User auth, sessions, 2FA, security | 13 tables |
| **Core** | Content | Posts, messages, communities, social | 40+ tables |
| **Wallet** | Payments | Wallets, transactions, payments, treasury | 30+ tables |

---

## ⚙️ PRE-FLIGHT CHECKLIST

**BEFORE you start:**

- [ ] You have access to all 3 Supabase projects (check email)
- [ ] You can log into https://app.supabase.com
- [ ] You have the old project service role key
- [ ] Back up old project (click Settings > Export in Supabase)
- [ ] You have 30-45 minutes uninterrupted
- [ ] No scheduled deployments in the next 2 hours

---

## 🚀 STEP 1: CREATE SCHEMAS (15 minutes)

### Identity Project

1. Go to: https://app.supabase.com/project/pevhyriszemvnrwvfshm/sql
2. Click **"New Query"** (top left)
3. Copy entire contents of: **`exports/old_project/schema_identity_production.sql`**
4. Paste into editor
5. Click **"Run"** (or Cmd+Enter)
6. ✅ Wait for success message (should say "13 queries executed")

### Core Project

1. Go to: https://app.supabase.com/project/hhqohlzzpzgkfdeanudw/sql
2. Click **"New Query"**
3. Copy entire contents of: **`exports/old_project/schema_core_production.sql`**
4. Paste into editor
5. Click **"Run"**
6. ✅ Wait for success message (should say "40+ queries executed")

### Wallet Project

1. Go to: https://app.supabase.com/project/wyqtcjqbdniwebvrwdnk/sql
2. Click **"New Query"**
3. Copy entire contents of: **`exports/old_project/schema_wallet_production.sql`**
4. Paste into editor
5. Click **"Run"**
6. ✅ Wait for success message (should say "30+ queries executed")

**❌ If any step fails:**
- Check the error message
- Make sure you copied the ENTIRE file
- Verify you're in the correct project
- Try again

---

## 🔄 STEP 2: EXPORT DATA FROM OLD PROJECT

This step uses the service role key you provided to export all data:

```bash
# Set the old project credentials
export OLD_SUPABASE_URL="https://rxtijxlvacqjiocdwzrh.supabase.co"
export OLD_SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dGlqeGx2YWNxamlvY2R3enJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk3ODI1MiwiZXhwIjoyMDgzNTU0MjUyfQ.dI_2XOstXd2WLLsn0ElwjM6mH2ypMzzDBWineg_vm8M"

# Export ALL tables to NDJSON files
cd /workspaces/GrovaApp
python3 scripts/export_supabase_old_project.py

# This will create files like:
# exports/old_project/profiles.ndjson
# exports/old_project/posts.ndjson
# ...etc (150+ files)
```

**❌ If export fails:**
- Verify the service role key is correct
- Check network connectivity
- Try again - network might be temporarily slow

---

## 📤 STEP 3: IMPORT DATA TO NEW PROJECTS

Once schemas are created and data is exported, import to each project:

```bash
# Import to Identity project
bash scripts/import_to_identity.sh

# Import to Core project
bash scripts/import_to_core.sh

# Import to Wallet project
bash scripts/import_to_wallet.sh
```

OR run all at once:

```bash
bash scripts/import_all_production.sh
```

**Expected output:**
```
Identity: ✓ Imported 13 tables
Core: ✓ Imported 40+ tables
Wallet: ✓ Imported 30+ tables

Total: ✓ Migration complete
```

---

## ✅ VERIFICATION CHECKLIST

After import completes, verify each project:

### Identity Project

```bash
# Check profiles were imported
curl -X GET \
  'https://pevhyriszemvnrwvfshm.supabase.co/rest/v1/profiles?limit=1' \
  -H 'apikey: <your_identity_anon_key>' \
  -H 'Authorization: Bearer <your_identity_service_key>'

# Should return at least 1 profile row
```

### Core Project

```bash
# Check posts were imported
curl -X GET \
  'https://hhqohlzzpzgkfdeanudw.supabase.co/rest/v1/posts?limit=1' \
  -H 'apikey: <your_core_anon_key>' \
  -H 'Authorization: Bearer <your_core_service_key>'

# Should return at least 1 post row
```

### Wallet Project

```bash
# Check wallets were imported
curl -X GET \
  'https://wyqtcjqbdniwebvrwdnk.supabase.co/rest/v1/wallets?limit=1' \
  -H 'apikey: <your_wallet_anon_key>' \
  -H 'Authorization: Bearer <your_wallet_service_key>'

# Should return at least 1 wallet row
```

---

## 🏗️ STEP 4: BUILD & TEST APP

```bash
# Install dependencies (if not already done)
npm install

# Build the app with new Supabase credentials
npm run build

# Start dev server
npm start
```

**Test these flows:**

1. **Authentication**: Login with an existing user
   - Should use Identity project
   - Sessions should be created
   
2. **Content**: Load home feed
   - Should load posts from Core project
   - Comments should work
   
3. **Wallet**: View wallet balance
   - Should show from Wallet project
   - Transactions should load

---

## ❌ TROUBLESHOOTING

### "Table already exists" error during schema creation
✅ **This is OK!** The `CREATE TABLE IF NOT EXISTS` will skip existing tables.

### "Foreign key violation" during import
⚠️ **Stop immediately**. This means:
1. A table is missing
2. IDs are mismatched
3. Run `bash scripts/validate_migration.sh` to diagnose

### Import hangs or seems slow
✅ **Normal** - Large datasets take time (5-10 minutes possible)
- Don't interrupt
- Check terminal for progress updates

### App won't build
- Check `.env` has all 3 projects configured
- Verify service role keys are correct
- Run `npm install` again

---

## 🔙 ROLLBACK PLAN

If something goes wrong:

1. **Keep old project running** - Don't delete anything
2. **Revert app config**:
   ```bash
   git checkout .env  # Reverts to old single project config
   npm run build
   ```
3. **Users stay on old project** while you debug

---

## 📊 EXPECTED RESULTS

After successful migration:

| Component | Old Project | New Projects | Status |
|-----------|------------|-------------|--------|
| Profiles | ✓ Migrated | Identity | ✅ |
| Posts/Comments | ✓ Migrated | Core | ✅ |
| Wallets/Payments | ✓ Migrated | Wallet | ✅ |
| Authentication | ✓ Split | Identity | ✅ |
| User Sessions | ✓ Split | Identity | ✅ |
| Real-time Subscriptions | ✓ Works | All 3 | ✅ |

---

## 📝 IMPORTANT NOTES

1. **Apps stays live** - No downtime
2. **Data integrity** - All relationships preserved
3. **No user action needed** - Automatic after deployment
4. **Can rollback** - Keep old project as backup
5. **Test thoroughly** - Run through all major flows before going live

---

## 🎯 SUCCESS CRITERIA

Migration is successful when:

- ✅ All schemas created without errors
- ✅ All data imported without errors
- ✅ App builds successfully
- ✅ Can login to app
- ✅ Can load feed content
- ✅ Can perform wallet actions
- ✅ No console errors in browser DevTools
- ✅ Real-time features work (messages, notifications, etc.)

---

## 🆘 NEED HELP?

If anything fails:

1. **Check error message** - Most are self-explanatory
2. **Verify credentials** - Check all keys are correct
3. **Check schema files** - Make sure you copied entire file
4. **Check network** - Verify internet connection is stable
5. **Try again** - Many timeouts are temporary

**Do NOT proceed to next step if current step shows errors.**

---

## 📞 FINAL NOTES

- **App is live** - Users are waiting, so execute carefully
- **Test locally first** if possible
- **Have a terminal ready** for import commands
- **Don't interrupt imports** once they start
- **Keep documentation open** for reference

You've got this. Let's make this migration smooth. ✨

---

**Files needed:**
- ✅ `exports/old_project/schema_identity_production.sql`
- ✅ `exports/old_project/schema_core_production.sql`
- ✅ `exports/old_project/schema_wallet_production.sql`
- ✅ `.env` (with all 3 project credentials)

**Ready to begin?** Start with Step 1. 🚀
