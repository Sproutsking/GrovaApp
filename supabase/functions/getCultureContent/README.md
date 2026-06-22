# getCultureContent Edge Function

Simple example Node function to fetch culture content for a given category.

Environment variables required:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Query params:
- category (uuid) — required
- offset (int) — optional
- limit (int) — optional

Response JSON:
{
  posts: [...],
  reels: [...],
  stories: [...]
}

Deploy this to your Supabase Edge Functions environment or any server that can access your Supabase project. Then set `REACT_APP_CULTURE_EDGE_URL` to the function URL so the client will call the edge endpoint as a fallback.
