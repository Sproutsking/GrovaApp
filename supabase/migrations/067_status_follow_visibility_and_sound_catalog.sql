-- Enforce the status audience and interaction contract in the database.
-- A status is visible to its owner and to users who follow its owner.

create index if not exists follows_follower_following_idx
  on public.follows(follower_id, following_id);

alter table public.status_updates enable row level security;
alter table public.status_likes enable row level security;
alter table public.sounds enable row level security;

alter table public.sounds
  add column if not exists audio_url text,
  add column if not exists storage_path text,
  add column if not exists duration numeric;

drop policy if exists status_updates_followers_select on public.status_updates;
create policy status_updates_followers_select
  on public.status_updates for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = status_updates.user_id
    )
  );

drop policy if exists status_updates_owner_insert on public.status_updates;
create policy status_updates_owner_insert
  on public.status_updates for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists status_updates_owner_update on public.status_updates;
create policy status_updates_owner_update
  on public.status_updates for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists status_updates_owner_delete on public.status_updates;
create policy status_updates_owner_delete
  on public.status_updates for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists status_likes_eligible_select on public.status_likes;
create policy status_likes_eligible_select
  on public.status_likes for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.status_updates s
      join public.follows f on f.following_id = s.user_id
      where s.id = status_likes.status_id
        and f.follower_id = auth.uid()
    )
  );

drop policy if exists status_likes_eligible_insert on public.status_likes;
create policy status_likes_eligible_insert
  on public.status_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.status_updates s
      where s.id = status_likes.status_id
        and (
          s.user_id = auth.uid()
          or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid()
              and f.following_id = s.user_id
          )
        )
    )
  );

drop policy if exists status_likes_owner_delete on public.status_likes;
create policy status_likes_owner_delete
  on public.status_likes for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists sounds_authenticated_select on public.sounds;
create policy sounds_authenticated_select
  on public.sounds for select to authenticated
  using (true);
