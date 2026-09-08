-- Track how each provider connection was established.
-- Auth identities and publishing/profile links are different connection modes.
alter table public.connections
  add column if not exists connected_via text;

-- The client and distribution layer treat one token as the current credential
-- for a connection. Remove older duplicates before enforcing that invariant.
with ranked_tokens as (
  select id,
         row_number() over (
           partition by connection_id
           order by revoked asc, created_at desc nulls last, id desc
         ) as row_number
  from public.tokens
  where connection_id is not null
)
delete from public.tokens t
using ranked_tokens r
where t.id = r.id and r.row_number > 1;

create unique index if not exists tokens_connection_id_key
  on public.tokens (connection_id)
  where connection_id is not null;

comment on column public.connections.connected_via is
  'supabase_identity, supabase_auth, oauth_popup, or profile_link';
