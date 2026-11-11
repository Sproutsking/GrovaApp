create table if not exists public.xrd_public_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('social', 'portfolio', 'report')),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  url text not null check (
    char_length(url) <= 2048
    and url ~* '^https?://'
  ),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists xrd_public_links_profile_visibility_idx
  on public.xrd_public_links(profile_id, visibility, category, created_at);

alter table public.xrd_public_links enable row level security;
revoke all on public.xrd_public_links from public, anon;
grant select, insert, update, delete on public.xrd_public_links to authenticated;

drop policy if exists xrd_public_links_owner_manage on public.xrd_public_links;
create policy xrd_public_links_owner_manage on public.xrd_public_links
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create or replace function public.get_public_xrd_links(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with target as (
    select profile.id
    from public.profiles profile
    where lower(ltrim(trim(profile.username), '@')) = lower(ltrim(trim(p_username), '@'))
      and profile.deleted_at is null
    limit 1
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', link.id,
      'category', link.category,
      'label', link.label,
      'url', link.url,
      'visibility', link.visibility,
      'created_at', link.created_at
    )
    order by link.category, link.created_at
  ), '[]'::jsonb)
  from public.xrd_public_links link
  where link.profile_id = (select target.id from target)
    and link.visibility = 'public';
$$;

revoke all on function public.get_public_xrd_links(text) from public;
grant execute on function public.get_public_xrd_links(text) to anon, authenticated;
