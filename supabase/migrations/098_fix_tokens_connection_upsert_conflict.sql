-- The client upserts tokens with ON CONFLICT (connection_id). A partial unique
-- index cannot be inferred by that conflict target, so replace it with a
-- regular unique index. PostgreSQL still permits multiple NULL connection IDs.
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

drop index if exists public.tokens_connection_id_key;

create unique index tokens_connection_id_key
  on public.tokens (connection_id);
