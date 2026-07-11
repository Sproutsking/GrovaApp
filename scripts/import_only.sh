#!/bin/bash

# =============================================================================
# IMPORT ONLY - SUPABASE SPLIT PROJECTS
# =============================================================================
# This script imports exported NDJSON data into split Supabase projects
# without attempting any schema application.
#
# REQUIREMENTS:
#   - .env file with all 3 project credentials configured
#   - python3 and pip with requests module
#   - Data already exported to exports/old_project/*.ndjson
#
# USAGE:
#   bash scripts/import_only.sh
#   BOUNDARY_ONLY=core bash scripts/import_only.sh
#
# =============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPORT_DIR="${EXPORT_DIR:-$PROJECT_ROOT/exports/old_project}"
BOUNDARY_MAP_FILE="${BOUNDARY_MAP_FILE:-boundary_map.json}"
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [ -z "$IDENTITY_SUPABASE_URL" ] || [ -z "$IDENTITY_SUPABASE_SERVICE_ROLE_KEY" ] || [ -z "$CORE_SUPABASE_URL" ] || [ -z "$CORE_SUPABASE_SERVICE_ROLE_KEY" ] || [ -z "$WALLET_SUPABASE_URL" ] || [ -z "$WALLET_SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing required Supabase environment variables."
  echo "Ensure IDENTITY_SUPABASE_URL, IDENTITY_SUPABASE_SERVICE_ROLE_KEY, CORE_SUPABASE_URL, CORE_SUPABASE_SERVICE_ROLE_KEY, WALLET_SUPABASE_URL, and WALLET_SUPABASE_SERVICE_ROLE_KEY are set."
  exit 1
fi

if [ ! -d "$EXPORT_DIR" ]; then
  echo "❌ Export directory not found: $EXPORT_DIR"
  exit 1
fi

if [ -z "$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ndjson' | head -n 1)" ]; then
  echo "❌ No NDJSON files found in $EXPORT_DIR"
  exit 1
fi

cd "$PROJECT_ROOT"

echo "=========================================================================="
echo "Supabase Split Migration - Import Only"
echo "=========================================================================="
echo "This script imports boundary data only. It will NOT apply schemas."
echo "Using export directory: $EXPORT_DIR"
echo "Using boundary map: $BOUNDARY_MAP_FILE"
echo "=========================================================================="
echo ""

import_boundary() {
  local boundary="$1"
  local url="$2"
  local key="$3"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Importing $boundary project data"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  BOUNDARY="$boundary" \
  TARGET_SUPABASE_URL="$url" \
  TARGET_SUPABASE_SERVICE_ROLE_KEY="$key" \
  EXPORT_DIR="$EXPORT_DIR" \
  BOUNDARY_MAP_FILE="$BOUNDARY_MAP_FILE" \
  python3 scripts/import_split_supabase_by_boundary.py || {
    echo "❌ $boundary import failed"
    exit 1
  }

  echo ""
  echo "✓ $boundary project import completed"
  echo ""
}

if [ -n "$BOUNDARY_ONLY" ]; then
  case "$BOUNDARY_ONLY" in
    identity|core|wallet)
      echo "Importing only boundary: $BOUNDARY_ONLY"
      ;;
    *)
      echo "❌ Invalid boundary specified: $BOUNDARY_ONLY"
      echo "Use BOUNDARY_ONLY=identity|core|wallet"
      exit 1
      ;;
  esac
fi

if [ -n "$BOUNDARY_ONLY" ]; then
  case "$BOUNDARY_ONLY" in
    identity)
      import_boundary "identity" "$IDENTITY_SUPABASE_URL" "$IDENTITY_SUPABASE_SERVICE_ROLE_KEY"
      ;;
    core)
      import_boundary "core" "$CORE_SUPABASE_URL" "$CORE_SUPABASE_SERVICE_ROLE_KEY"
      ;;
    wallet)
      import_boundary "wallet" "$WALLET_SUPABASE_URL" "$WALLET_SUPABASE_SERVICE_ROLE_KEY"
      ;;
  esac
else
  import_boundary "identity" "$IDENTITY_SUPABASE_URL" "$IDENTITY_SUPABASE_SERVICE_ROLE_KEY"
  import_boundary "core" "$CORE_SUPABASE_URL" "$CORE_SUPABASE_SERVICE_ROLE_KEY"
  import_boundary "wallet" "$WALLET_SUPABASE_URL" "$WALLET_SUPABASE_SERVICE_ROLE_KEY"
fi

echo "=========================================================================="
echo "✅ Import-only run completed"
echo "=========================================================================="
echo ""
echo "Next steps:"
echo "1. Verify the imported data in each Supabase project." 
