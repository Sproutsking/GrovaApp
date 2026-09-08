-- Repair account linking persistence.
-- The client upserts one connection per user/provider, so the schema must enforce
-- that same invariant instead of requiring platform_user_id in the conflict key.

with ranked_connections as (
  select id,
         row_number() over (
           partition by user_id, provider
           order by case when auth_status = 'active' then 0 else 1 end, updated_at desc nulls last, created_at desc nulls last, id desc
         ) as row_number
  from public.connections
)
delete from public.connections c
using ranked_connections r
where c.id = r.id and r.row_number > 1;

alter table public.connections
  drop constraint if exists connections_user_id_provider_platform_user_id_key;

alter table public.connections
  add constraint connections_user_id_provider_key unique (user_id, provider);

alter table public.connections enable row level security;
alter table public.tokens enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'connections' and policyname = 'connections_owner_select') then
    create policy connections_owner_select on public.connections for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'connections' and policyname = 'connections_owner_insert') then
    create policy connections_owner_insert on public.connections for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'connections' and policyname = 'connections_owner_update') then
    create policy connections_owner_update on public.connections for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'connections' and policyname = 'connections_owner_delete') then
    create policy connections_owner_delete on public.connections for delete using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tokens' and policyname = 'tokens_owner_select') then
    create policy tokens_owner_select on public.tokens for select using (exists (select 1 from public.connections c where c.id = tokens.connection_id and c.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tokens' and policyname = 'tokens_owner_insert') then
    create policy tokens_owner_insert on public.tokens for insert with check (exists (select 1 from public.connections c where c.id = tokens.connection_id and c.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tokens' and policyname = 'tokens_owner_update') then
    create policy tokens_owner_update on public.tokens for update using (exists (select 1 from public.connections c where c.id = tokens.connection_id and c.user_id = auth.uid())) with check (exists (select 1 from public.connections c where c.id = tokens.connection_id and c.user_id = auth.uid()));
  end if;
end $$;
