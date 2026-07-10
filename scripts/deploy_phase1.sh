#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${1:-pevhyriszemvnrwvfshm}"
LOG_DIR="supabase-deploy-logs/phase1"
mkdir -p "$LOG_DIR"

functions=(
  generate-2fa
  verify-2fa-login
  verify-2fa-setup
  identity-sync
  send-auth-email
  generate-deeplink
  store-connection-token
)

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is not available. Install it first." >&2
  exit 1
fi

for fn in "${functions[@]}"; do
  echo "Deploying $fn -> $PROJECT_REF"
  log_file="$LOG_DIR/$fn.log"
  if supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt > "$log_file" 2>&1; then
    echo "✔ Success: $fn"
  else
    echo "✖ Failed: $fn"
    echo "See $log_file"
  fi
done

echo "Phase 1 deployment attempts completed. Logs: $LOG_DIR"
