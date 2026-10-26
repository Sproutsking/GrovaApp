-- Keep provider refresh credentials available for server-side refresh flows.
alter table public.tokens
  add column if not exists refresh_token text;

-- Return readiness only; provider credentials stay out of browser queries.
create or replace function public.get_distribution_connection_states(p_user_id uuid)
returns table (
  provider text,
  auth_status text,
  platform_user_id text,
  has_valid_token boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.provider,
    c.auth_status,
    c.platform_user_id,
    exists (
      select 1
      from public.tokens t
      where t.connection_id = c.id
        and t.revoked = false
        and t.encrypted_token is not null
        and (t.expires_at is null or t.expires_at > now())
    ) as has_valid_token
  from public.connections c
  where c.user_id = auth.uid()
    and c.user_id = p_user_id;
$$;

revoke all on function public.get_distribution_connection_states(uuid) from public;
grant execute on function public.get_distribution_connection_states(uuid) to authenticated;

-- Persist distribution outcomes, including retries, in a stable per-post,
-- per-platform row so publishing can be safely re-run.
create table if not exists public.post_distribution (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  status text not null default 'pending'
    check (status in ('pending', 'publishing', 'success', 'failed')),
  external_post_id text,
  error_message text,
  retry_count integer not null default 0,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists post_distribution_post_platform_key
  on public.post_distribution (post_id, platform);

create index if not exists post_distribution_user_created_idx
  on public.post_distribution (user_id, created_at desc);

alter table public.post_distribution enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_distribution'
      and policyname = 'post_distribution_owner_access'
  ) then
    create policy post_distribution_owner_access
      on public.post_distribution
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;
