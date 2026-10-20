alter table public.posts
  add column if not exists audience text not null default 'public';

alter table public.posts
  drop constraint if exists posts_audience_check;

alter table public.posts
  add constraint posts_audience_check
  check (audience in ('public', 'followers', 'verified'));

alter table public.drafts
  add column if not exists post_audience text not null default 'public';

alter table public.drafts
  add column if not exists culture_caption text,
  add column if not exists culture_category text not null default 'trending';

alter table public.drafts
  add column if not exists post_is_text_card boolean not null default false,
  add column if not exists post_caption text;

alter table public.drafts
  drop constraint if exists drafts_post_audience_check;

alter table public.drafts
  add constraint drafts_post_audience_check
  check (post_audience in ('public', 'followers', 'verified'));

alter table public.drafts
  drop constraint if exists drafts_content_type_check;

alter table public.drafts
  add constraint drafts_content_type_check
  check (content_type in ('post', 'reel', 'story', 'culture'));

create or replace function public.post_audience_allows_read(p_user_id uuid, p_audience text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() = p_user_id or p_audience = 'public' then
    return true;
  end if;

  if auth.uid() is null then
    return false;
  end if;

  if p_audience = 'followers' then
    return exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = p_user_id
    );
  end if;

  if p_audience = 'verified' then
    return exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.verified, false)
    );
  end if;

  return false;
end;
$$;

alter function public.post_audience_allows_read(uuid, text) owner to postgres;
revoke all on function public.post_audience_allows_read(uuid, text) from public;
grant execute on function public.post_audience_allows_read(uuid, text) to anon, authenticated;

drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts
  for select to anon, authenticated
  using (
    (deleted_at is null and public.post_audience_allows_read(user_id, audience))
    or (auth.uid() is not null and user_id = auth.uid())
  );

create table if not exists public.content_distribution (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('reel', 'story')),
  content_id uuid not null,
  platform text not null,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed', 'fallback')),
  external_post_id text,
  error_message text,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (content_type, content_id, platform)
);

alter table public.content_distribution enable row level security;

drop policy if exists content_distribution_owner_select on public.content_distribution;
create policy content_distribution_owner_select on public.content_distribution
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists content_distribution_owner_insert on public.content_distribution;
create policy content_distribution_owner_insert on public.content_distribution
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists content_distribution_owner_update on public.content_distribution;
create policy content_distribution_owner_update on public.content_distribution
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists content_distribution_owner_recent_idx
  on public.content_distribution (user_id, created_at desc);
