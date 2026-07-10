# Supabase Split Migration Implementation Prompt

Objective:
Implement the migration from the old Supabase project into the three split projects for Identity, Core, and Wallet, using the local export already generated in this workspace.

Current status in this workspace:
- The old live project has already been exported into [exports/old_project](../exports/old_project).
- The export snapshot includes NDJSON files plus [exports/old_project/manifest.json](../exports/old_project/manifest.json) and [exports/old_project/boundary_map.json](../exports/old_project/boundary_map.json).
- The app-side split wiring already exists in [src/services/supabase/projectBoundaries.js](../src/services/supabase/projectBoundaries.js) and [src/services/supabase/multiClient.js](../src/services/supabase/multiClient.js).
- A starter importer script exists at [scripts/import_split_supabase.py](../scripts/import_split_supabase.py).

Important constraint:
Do not invent or guess credentials. Use the actual service-role or database credentials from the correct Supabase projects and the correct account. The import must not proceed with invalid keys.

Target architecture:
- Identity project: auth, sessions, MFA, recovery, security, notification preferences, profile identity data.
- Core project: profiles, content, feeds, communities, messaging, social graph, drafts, news, reels, stories.
- Wallet project: wallets, addresses, wallet history, transactions, payments, payment intents, withdrawals, treasury and payout data.

Implementation plan:

1. Confirm the target credentials
- Verify the real service-role values for:
  - Identity: pevhyriszemvnrwvfshm
  - Core: hhqohlzzpzgkfdeanudw
  - Wallet: wyqtcjqbdniwebvrwdnk
- Update [.env](../.env) with the real values for:
  - IDENTITY_SUPABASE_SERVICE_ROLE_KEY
  - CORE_SUPABASE_SERVICE_ROLE_KEY
  - WALLET_SUPABASE_SERVICE_ROLE_KEY
- If REST API imports fail with 401, use the Postgres connection string from the Supabase project settings and import with psql instead of REST.

2. Import the exported data into the correct target projects
- Use the data in [exports/old_project](../exports/old_project) as the source of truth.
- Import tables according to the boundaries in [exports/old_project/boundary_map.json](../exports/old_project/boundary_map.json).
- Do not try to import every table into every project.

3. Create or verify the target schema
- Ensure the target tables exist in the three new projects before importing rows.
- If a table does not exist, create it with the appropriate columns and types.
- Preserve primary keys, UUIDs, timestamps, FK relationships where possible, and nullable fields.

4. Import data in a safe order
- Identity first: profiles, sessions, recovery, MFA, security, notification prefs.
- Core second: communities, channels, members, roles, content, posts, comments, messages, drafts, social tables.
- Wallet last: wallets, wallet_history, addresses, transactions, payments, payment_intents, withdrawals, treasury tables.
- Import in dependency order to avoid broken foreign-key relationships.

5. Validate the split
- Confirm row counts per table in the source snapshot and target projects.
- Compare IDs and counts for the main tables.
- Run the app build and verify the split client selection still works.

6. Finish the app integration
- Ensure the app reads from the correct project for each role.
- Verify the environment variables used by [src/services/supabase/projectBoundaries.js](../src/services/supabase/projectBoundaries.js) and [src/services/supabase/multiClient.js](../src/services/supabase/multiClient.js) are correct.
- Run the build again and confirm success.

Recommended execution order:
1. Fix credentials and authentication.
2. Import Identity data first.
3. Import Core data second.
4. Import Wallet data last.
5. Validate counts and relationships.
6. Run build and smoke-test the app.

What success looks like:
- All intended tables are present in the target projects.
- Row counts are consistent with the export snapshot.
- The app can still authenticate, load content, and process wallet actions through the split projects.
- The repository build passes.

Use this repository as the implementation base:
- [scripts/export_supabase_old_project.py](../scripts/export_supabase_old_project.py)
- [scripts/import_split_supabase.py](../scripts/import_split_supabase.py)
- [exports/old_project](../exports/old_project)
- [src/services/supabase/projectBoundaries.js](../src/services/supabase/projectBoundaries.js)
- [src/services/supabase/multiClient.js](../src/services/supabase/multiClient.js)
