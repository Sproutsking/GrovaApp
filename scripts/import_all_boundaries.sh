#!/bin/bash
# Batch import all three Supabase project boundaries
# Run this after creating schemas in all three projects

set -e

echo "=========================================================================="
echo "Supabase Split Migration - Batch Data Import"
echo "=========================================================================="
echo ""
echo "This script will import data into all three projects in sequence."
echo "Make sure all schemas have been created first!"
echo ""

cd /workspaces/GrovaApp

# Identity Project
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1/3: Importing Identity Project Data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
BOUNDARY=identity \
TARGET_SUPABASE_URL=https://pevhyriszemvnrwvfshm.supabase.co \
TARGET_SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBldmh5cmlzemVtdm5yd3Zmc2htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU0MTE0MSwiZXhwIjoyMDk5MTE3MTQxfQ.q6v5NKq0xqO-bsZYtHymAoxlDhKq1RzXj3cH-UR6ziY' \
python3 scripts/import_split_supabase_by_boundary.py || {
    echo "❌ Identity import failed"
    exit 1
}

echo ""
echo "✓ Identity project import completed"
echo ""

# Core Project
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2/3: Importing Core Project Data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
BOUNDARY=core \
TARGET_SUPABASE_URL=https://hhqohlzzpzgkfdeanudw.supabase.co \
TARGET_SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocW9obHp6cHpna2ZkZWFudWR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU0MjQxMiwiZXhwIjoyMDk5MTE4NDEyfQ.03P0hnVJtGPZwuCF-AMk0MM6XWz4B51DSMOfJjdBHSM' \
python3 scripts/import_split_supabase_by_boundary.py || {
    echo "❌ Core import failed"
    exit 1
}

echo ""
echo "✓ Core project import completed"
echo ""

# Wallet Project
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3/3: Importing Wallet Project Data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
BOUNDARY=wallet \
TARGET_SUPABASE_URL=https://wyqtcjqbdniwebvrwdnk.supabase.co \
TARGET_SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5cXRjanFiZG5pd2VidnJ3ZG5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU0MjQ2OSwiZXhwIjoyMDk5MTE4NDY5fQ.c9bNURo0FxkO5Ymq2xaguJPAOt_NCafDpoPzoGVlu64' \
python3 scripts/import_split_supabase_by_boundary.py || {
    echo "❌ Wallet import failed"
    exit 1
}

echo ""
echo "✓ Wallet project import completed"
echo ""

echo "=========================================================================="
echo "✅ All data imports completed successfully!"
echo "=========================================================================="
echo ""
echo "Next steps:"
echo "1. Verify data in each project via Supabase dashboard"
echo "2. Check row counts match the export manifest"
echo "3. Run 'npm run build' to build the app"
echo "4. Test authentication and core functionality"
echo ""
