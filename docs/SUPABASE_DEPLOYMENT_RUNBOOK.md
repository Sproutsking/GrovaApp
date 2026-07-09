# Supabase deployment runbook for the three projects

This document gives a safe, project-by-project deployment sequence for the Xeevia split.

## Goal
Deploy the right edge functions to the right Supabase project and keep secrets scoped by ownership.

## Project ownership
- Identity project: auth, MFA, OAuth, recovery, sessions
- Core project: content, feeds, communities, media metadata, notifications
- Wallet project: payments, ledgers, payout, webhooks, RPC integrations

## Deployment order
1. Identity project
2. Core project
3. Wallet project

## One-project-at-a-time flow
For each project:
1. Log into the correct Supabase account/project.
2. Set the project secrets for that project.
3. Deploy the functions assigned to that project.
4. Verify deployment.
5. Log out and move to the next project.

## Required CLI tools
- `supabase` CLI
- `jq` or similar for simple verification

## Recommended commands

### Identity project
```bash
supabase login
supabase link --project-ref <IDENTITY_PROJECT_REF>
supabase secrets set IDENTIY_SUPABASE_URL=... IDENTIY_SUPABASE_ANON_KEY=... IDENTIY_SUPABASE_SERVICE_ROLE_KEY=...
supabase functions deploy auth-callback
supabase functions deploy oauth-authorize
supabase functions deploy oauth-token
supabase functions deploy mfa-verify
supabase functions deploy recovery-issue
```

### Core project
```bash
supabase login
supabase link --project-ref <CORE_PROJECT_REF>
supabase secrets set CORE_SUPABASE_URL=... CORE_SUPABASE_ANON_KEY=... CORE_SUPABASE_SERVICE_ROLE_KEY=...
supabase functions deploy create-post
supabase functions deploy update-post
supabase functions deploy feed-generate
supabase functions deploy notification-dispatch
```

### Wallet project
```bash
supabase login
supabase link --project-ref <WALLET_PROJECT_REF>
supabase secrets set WALLET_SUPABASE_URL=... WALLET_SUPABASE_ANON_KEY=... WALLET_SUPABASE_SERVICE_ROLE_KEY=...
supabase functions deploy deposit-paystack-init
supabase functions deploy withdraw-init
supabase functions deploy webhook-opay
supabase functions deploy webhook-flutterwave
supabase functions deploy wallet-ledger-sync
```

## Verification checklist
- Function deployed successfully
- Secrets available in the project
- Function logs show no startup errors
- A test request returns success

## Important note
Do not deploy all functions to all projects. Deploy by ownership only.
