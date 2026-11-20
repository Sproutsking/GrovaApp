#!/usr/bin/env bash
set -euo pipefail

# Deploy only existing, explicitly selected functions with per-function JWT settings.

SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
LOG_DIR="supabase-deploy-logs"
WHITELIST=(
  "trade-actions"
  "deposit-paystack-webhook"
  "withdraw-paystack-webhook"
  "deposit-paystack-init"
  "paystack-create-transaction"
  "paystack-webhook"
  "web3-verify-payment"
  "get-push-config"
  "send-push-fcm"
)

if [[ ! "$SUPABASE_PROJECT_REF" =~ ^[a-z0-9]{20}$ ]]; then
  echo "ERROR: Set SUPABASE_PROJECT_REF to the intended Supabase project ref."
  exit 2
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: Supabase CLI is required to deploy functions."
  exit 2
fi

mkdir -p "$LOG_DIR"
failed=0

for fn in "${WHITELIST[@]}"; do
  dir="supabase/functions/$fn"
  index="$dir/index.ts"
  log="$LOG_DIR/$fn.log"

  if [ ! -f "$index" ]; then
    echo "ERROR: Refusing to deploy missing function source: $index"
    failed=1
    continue
  fi

  deploy_flags=()
  case "$fn" in
    deposit-paystack-webhook|withdraw-paystack-webhook|paystack-webhook)
      deploy_flags+=(--no-verify-jwt)
      ;;
  esac

  echo "→ Deploying $fn (logging to $log)"
  if supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF" "${deploy_flags[@]}" > "$log" 2>&1; then
    echo "✔ Deploy succeeded: $fn"
  else
    echo "ERROR: Deploy failed: $fn — see $log"
    failed=1
  fi
done

echo "Selected functions processed. Logs: $LOG_DIR/"
exit "$failed"
