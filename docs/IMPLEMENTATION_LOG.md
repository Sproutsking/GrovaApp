# Implementation log — Supabase multi-project split

## What we have done
- Created a multi-client Supabase adapter at `src/services/supabase/multiClient.js`.
- The adapter exposes `identityClient`, `coreClient`, `walletClient`, and `getSupabaseClient(role)`.
- The adapter uses the existing browser auth storage pattern and defaults to the current Supabase values if the new project-specific env vars are not yet set.

## Why this matters
- This is the first implementation slice for the three-project architecture.
- It allows the app to use an Identity project for auth, a Core project for content data, and a Wallet project for payment flows without rewriting every call site at once.

## What is next
1. Add the three project-specific env vars to the local `.env` file and the deployment environment.
2. Switchover the auth flow to use `identityClient`.
3. Move content/profile writes to `coreClient`.
4. Route wallet actions through `walletClient` and server-side edge functions.
5. Add a feature flag to toggle the split architecture safely.

## Required input from you
- The three Supabase project URLs and anon keys from your three accounts.
- Confirmation of which app surface to migrate first: auth, profile creation, or wallet.
