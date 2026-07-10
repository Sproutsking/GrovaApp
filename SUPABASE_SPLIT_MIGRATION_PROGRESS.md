# Supabase Split Migration - Progress Summary & Next Steps

## ✅ Completed So Far

### 1. **Repository Updated**
- ✓ Pulled latest from main branch
- ✓ All live changes integrated

### 2. **Credentials & Configuration**
- ✓ Collected service role keys for all three projects:
  - **Identity** (pevhyriszemvnrwvfshm): ✓ Configured
  - **Core** (hhqohlzzpzgkfdeanudw): ✓ Configured
  - **Wallet** (wyqtcjqbdniwebvrwdnk): ✓ Configured
- ✓ Updated `.env` with all project URLs and keys
- ✓ Database passwords collected

### 3. **Schema Generation**
- ✓ Analyzed 84 NDJSON data files from old project export
- ✓ Inferred database schema from exported data
- ✓ Generated CREATE TABLE statements for all boundaries:
  - **Identity**: 8 core tables (`schema_identity.sql` - 134 lines)
  - **Core**: 25 content tables (`schema_core.sql` - 360 lines)
  - **Wallet**: 19 ledger tables (`schema_wallet.sql` - 280 lines)
  - **All**: Combined schema (`schema_all.sql` - 770 lines)

### 4. **Import Scripts Prepared**
- ✓ Created `scripts/import_split_supabase_by_boundary.py` - Intelligent boundary-aware importer
- ✓ Ready to import data for each boundary separately
- ✓ Error handling and progress reporting included

---

## ⚠️ Current Blocker: Schema Creation

**Issue:** Container network cannot directly access external Postgres servers.

**Solution:** You must create the schemas via the **Supabase Web Dashboard SQL Editor** for each project.

---

## 🚀 Next Steps (Do This Now)

### Step 1: Create Schemas in Each Project

For **EACH** of the three projects, follow these steps:

#### Identity Project (pevhyriszemvnrwvfshm)
1. Open https://app.supabase.com/project/pevhyriszemvnrwvfshm/sql
2. Click **New Query**
3. Copy entire contents of: `exports/old_project/schema_identity.sql`
4. Paste into editor and click **Run**
5. Wait for success message

#### Core Project (hhqohlzzpzgkfdeanudw)
1. Open https://app.supabase.com/project/hhqohlzzpzgkfdeanudw/sql
2. Click **New Query**
3. Copy entire contents of: `exports/old_project/schema_core.sql`
4. Paste into editor and click **Run**
5. Wait for success message

#### Wallet Project (wyqtcjqbdniwebvrwdnk)
1. Open https://app.supabase.com/project/wyqtcjqbdniwebvrwdnk/sql
2. Click **New Query**
3. Copy entire contents of: `exports/old_project/schema_wallet.sql`
4. Paste into editor and click **Run**
5. Wait for success message

**Time required:** ~5-10 minutes total

---

### Step 2: Import Data into Each Project

Once all schemas are created, run these import commands in order:

```bash
# Identity Project Import
BOUNDARY=identity \
TARGET_SUPABASE_URL=https://pevhyriszemvnrwvfshm.supabase.co \
TARGET_SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBldmh5cmlzemVtdm5yd3Zmc2htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU0MTE0MSwiZXhwIjoyMDk5MTE3MTQxfQ.q6v5NKq0xqO-bsZYtHymAoxlDhKq1RzXj3cH-UR6ziY' \
python3 scripts/import_split_supabase_by_boundary.py
```

```bash
# Core Project Import
BOUNDARY=core \
TARGET_SUPABASE_URL=https://hhqohlzzpzgkfdeanudw.supabase.co \
TARGET_SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocW9obHp6cHpna2ZkZWFudWR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU0MjQxMiwiZXhwIjoyMDk5MTE4NDEyfQ.03P0hnVJtGPZwuCF-AMk0MM6XWz4B51DSMOfJjdBHSM' \
python3 scripts/import_split_supabase_by_boundary.py
```

```bash
# Wallet Project Import
BOUNDARY=wallet \
TARGET_SUPABASE_URL=https://wyqtcjqbdniwebvrwdnk.supabase.co \
TARGET_SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5cXRjanFiZG5pd2VidnJ3ZG5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU0MjQ2OSwiZXhwIjoyMDk5MTE4NDY5fQ.c9bNURo0FxkO5Ymq2xaguJPAOt_NCafDpoPzoGVlu64' \
python3 scripts/import_split_supabase_by_boundary.py
```

Or use a single command to import all:

```bash
cd /workspaces/GrovaApp && bash scripts/import_all_boundaries.sh
```

---

## 📊 Data Volume

From the export manifest:

| Project | Tables | Estimated Rows |
|---------|--------|-----------------|
| Identity | 8 | ~250 |
| Core | 25 | ~2,500 |
| Wallet | 19 | ~1,500 |
| **Total** | **52** | **~4,250** |

---

## 📝 Key Files & Locations

```
exports/old_project/
├── boundary_map.json              # Defines table boundaries
├── manifest.json                  # Metadata about exported tables
├── schema_all.sql                 # Complete schema (770 lines)
├── schema_identity.sql            # Identity project schema
├── schema_core.sql                # Core project schema
├── schema_wallet.sql              # Wallet project schema
└── *.ndjson                       # Data files (84 files total)

scripts/
├── infer_schema.py                # Generates SQL from NDJSON data
├── import_split_supabase_by_boundary.py  # Intelligent boundary-aware importer
├── import_all_boundaries.sh       # Batch import script
└── apply_schema.py                # Direct Postgres connection (if available)

.env                               # Updated with all project configs
SCHEMA_CREATION_MANUAL.md          # Manual creation guide
SUPABASE_SPLIT_MIGRATION_PROGRESS.md  # This file
```

---

## 🔍 Verification Checklist

After data import completes:

- [ ] Identity project has ~8 tables with data
- [ ] Core project has ~25 tables with data
- [ ] Wallet project has ~19 tables with data
- [ ] Row counts match export manifest
- [ ] No 404 errors in import output
- [ ] App can build successfully
- [ ] App authentication works with Identity project
- [ ] App can load content from Core project
- [ ] Wallet functions work with Wallet project

---

## 🛠️ Troubleshooting

### Schema Creation Fails in Supabase Dashboard
- Copy only one table's CREATE TABLE statement at a time
- Verify the SQL Editor is showing no syntax errors
- Check table names match exactly (case-sensitive)

### Import Shows 404 Errors
- Verify schemas were created successfully
- Check that all columns exist in the target tables
- Run schema creation again if needed

### Connection Refused During Import
- Verify service role keys in .env are correct
- Check target project URLs are accessible
- Verify no firewall blocking the requests

---

## 📞 Support

All scripts include verbose logging. Check output for:
- ✓ = Table successfully imported
- ✗ = Error (details shown)
- ⊘ = Skipped (empty or not for this boundary)

Reference `exports/old_project/boundary_map.json` to understand which tables go to which project.

---

**Status:** Ready for manual schema creation + automated data import
**Last Updated:** 2024-07-10
