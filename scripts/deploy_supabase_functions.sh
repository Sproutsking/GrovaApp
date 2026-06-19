#!/usr/bin/env bash
set -euo pipefail

# Safe deploy script: creates missing function stubs, attempts deploy if supabase CLI available,
# and logs output to supabase-deploy-logs/. Exits 0 even if supabase CLI missing.

export SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-<your-project-ref>}"
SUPABASE_FLAGS="${SUPABASE_FLAGS:---no-verify-jwt}"
LOG_DIR="supabase-deploy-logs"
WHITELIST=("trade-actions" "deposit-paystack-webhook" "withdraw-paystack-webhook" "deposit-paystack-init")

mkdir -p "$LOG_DIR"

if ! command -v supabase >/dev/null 2>&1; then
  echo "WARNING: supabase CLI not found. The script will create stubs but skip actual deployment."
  echo "Install with: npm install -g supabase && supabase login"
  SUPABASE_AVAILABLE=false
else
  SUPABASE_AVAILABLE=true
fi

for fn in "${WHITELIST[@]}"; do
  dir="supabase/functions/$fn"
  index="$dir/index.ts"
  log="$LOG_DIR/$fn.log"

  if [ -f "$index" ]; then
    echo "→ Found existing function: $fn"
  else
    echo "→ Creating stub function: $fn"
    mkdir -p "$dir"
    cat > "$index" <<'TS'
export default async (req: Request) => {
  return new Response(JSON.stringify({ ok: false, message: "stub: function not implemented" }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
};
TS
    echo "Created $index"
    git add "$index" || true
  fi

  if [ "$SUPABASE_AVAILABLE" = true ]; then
    echo "→ Deploying $fn (logging to $log)"
    if supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF" $SUPABASE_FLAGS > "$log" 2>&1; then
      echo "✔ Deploy succeeded: $fn"
    else
      echo "⚠️ Deploy failed: $fn — see $log"
    fi
  else
    echo "→ Skipping deploy for $fn (supabase CLI missing)"
  fi

done

echo "Selected functions processed. Logs: $LOG_DIR/"
exit 0
