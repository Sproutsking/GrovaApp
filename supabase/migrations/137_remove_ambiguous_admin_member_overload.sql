-- Keep the text[] permissions RPC used by the admin UI as the single
-- manage_admin_member overload so PostgREST can resolve named-argument calls.
drop function if exists public.manage_admin_member(text, uuid, uuid, text, jsonb);
