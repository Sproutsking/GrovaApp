#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   export IDENTITY_SUPABASE_ACCESS_TOKEN="<token-for-identity-account>"
#   export CORE_SUPABASE_ACCESS_TOKEN="<token-for-core-account>"
#   export WALLET_SUPABASE_ACCESS_TOKEN="<token-for-wallet-account>"
#   export IDENTITY_SUPABASE_PROFILE="identity"   # optional
#   export CORE_SUPABASE_PROFILE="core"           # optional
#   export WALLET_SUPABASE_PROFILE="wallet"       # optional
#   export IDENTITY_SUPABASE_SERVICE_ROLE_KEY="<value>"
#   export CORE_SUPABASE_SERVICE_ROLE_KEY="<value>"
#   export WALLET_SUPABASE_SERVICE_ROLE_KEY="<value>"
#   bash scripts/set_supabase_secrets.sh

if [[ -z "${IDENTITY_SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "IDENTITY_SUPABASE_ACCESS_TOKEN is not set. Create a Supabase personal access token for the identity account and export it first." >&2
  exit 1
fi

if [[ -z "${CORE_SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "CORE_SUPABASE_ACCESS_TOKEN is not set. Create a Supabase personal access token for the core account and export it first." >&2
  exit 1
fi

if [[ -z "${WALLET_SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "WALLET_SUPABASE_ACCESS_TOKEN is not set. Create a Supabase personal access token for the wallet account and export it first." >&2
  exit 1
fi

if [[ -z "${IDENTITY_SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "IDENTITY_SUPABASE_SERVICE_ROLE_KEY is not set." >&2
  exit 1
fi

if [[ -z "${CORE_SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "CORE_SUPABASE_SERVICE_ROLE_KEY is not set." >&2
  exit 1
fi

if [[ -z "${WALLET_SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "WALLET_SUPABASE_SERVICE_ROLE_KEY is not set." >&2
  exit 1
fi

run_for_project() {
  local token="$1"
  local profile="$2"
  local project_ref="$3"
  local secret_name="$4"
  local secret_value="$5"
  local profile_args=()
  if [[ -n "$profile" ]]; then
    profile_args=(--profile "$profile")
  fi
  npx supabase login --token "$token" "${profile_args[@]}" >/dev/null
  npx supabase secrets set --project-ref "$project_ref" "${profile_args[@]}" \
    "$secret_name=$secret_value"
}

run_for_project "$IDENTITY_SUPABASE_ACCESS_TOKEN" "${IDENTITY_SUPABASE_PROFILE:-}" \
  pevhyriszemvnrwvfshm IDENTITY_SUPABASE_SERVICE_ROLE_KEY "$IDENTITY_SUPABASE_SERVICE_ROLE_KEY"

run_for_project "$CORE_SUPABASE_ACCESS_TOKEN" "${CORE_SUPABASE_PROFILE:-}" \
  hhqohlzzpzgkfdeanudw CORE_SUPABASE_SERVICE_ROLE_KEY "$CORE_SUPABASE_SERVICE_ROLE_KEY"

run_for_project "$WALLET_SUPABASE_ACCESS_TOKEN" "${WALLET_SUPABASE_PROFILE:-}" \
  wyqtcjqbdniwebvrwdnk WALLET_SUPABASE_SERVICE_ROLE_KEY "$WALLET_SUPABASE_SERVICE_ROLE_KEY"

echo "Supabase secrets update completed."
