# Deployment Guide

## Overview
This guide covers deploying the `getCultureContent` Supabase Edge Function, running the SQL migration `migrations/culture_schema.sql`, and wiring frontend environment variables so the app can call the function.

## Prerequisites
- `supabase` CLI installed: `npm install -g supabase`
- You are logged in: `supabase login`
- Have your Supabase `PROJECT_REF` and `SERVICE_ROLE_KEY` available ( Service Role key is required by the function to run server-side queries ).
- Repository already pushed to `origin/main` (done).

## 1) Run SQL migration (Supabase SQL editor)
1. Open your Supabase project dashboard → SQL Editor.
2. Create a new query and paste the contents of `migrations/culture_schema.sql`.
3. Run the query. Review results and fix any remaining DDL issues reported by Supabase.

Notes:
- The file already uses valid Postgres array syntax (e.g., `uuid[]`) and does not include `IF NOT EXISTS` for `CREATE POLICY` (which is invalid for policies).
- If seed rows conflict, the `ON CONFLICT (name) DO NOTHING` in the category inserts will avoid duplicate errors.

## 2) Deploy the Edge Function (`getCultureContent`)
From repo root:

```bash
# Link to your Supabase project (one-time)
supabase link --project-ref <PROJECT_REF>

# Change into the function directory
cd supabase/functions/getCultureContent

# Deploy the function (name is derived from the folder)
supabase functions deploy getCultureContent --project-ref <PROJECT_REF>
```

## 3) Configure secrets / env vars for the function
Set the required server-side environment variables (on Supabase they are stored as "secrets"):

```bash
# From repo root (or any folder)
# Replace <SERVICE_ROLE_KEY> and <SUPABASE_URL> with your values
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>" --project-ref <PROJECT_REF>
supabase secrets set SUPABASE_URL="https://<your-project>.supabase.co" --project-ref <PROJECT_REF>
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` must be kept secret. Use the Supabase UI or CLI to set it.
- `SUPABASE_URL` can be public but it's convenient to set it as an env var for the function.

## 4) Frontend wiring
Your frontend expects `REACT_APP_CULTURE_EDGE_URL` to point to the deployed function endpoint. After deploying the function, the URL will generally look like:

```
https://<PROJECT_REF>.functions.supabase.co/getCultureContent
```

Set the env var for your frontend environment (example for a `.env.production` file):

```
REACT_APP_CULTURE_EDGE_URL="https://<PROJECT_REF>.functions.supabase.co/getCultureContent"
```

Then rebuild and redeploy your frontend (Vercel, Netlify, GitHub Pages, etc.). Example local build:

```bash
# from repo root
npm run build
# deploy `build/` to your static host
```

## 5) Local testing of the function
You can run the local dev server included in `supabase/functions/getCultureContent/index.js`:

```bash
cd supabase/functions/getCultureContent
# set env vars locally for testing
export SUPABASE_URL="https://<your-project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>"
node index.js
# then test with curl
curl "http://localhost:8787?category=<category-id>&limit=10"
```

## 6) Rollback / updates
- To update the function, modify files under `supabase/functions/getCultureContent/` and run `supabase functions deploy getCultureContent` again.

## Troubleshooting
- If the function logs `Supabase env vars not configured` when hit, ensure you set `SUPABASE_SERVICE_ROLE_KEY` via `supabase secrets set` or via the Supabase dashboard.
- If SQL migration errors appear, paste the error here and I'll help resolve them.

---
If you want, I can attempt to deploy the function for you — but I will need either a logged-in supabase CLI in this environment linked to your project, or you can run the above commands locally and paste any errors back here.