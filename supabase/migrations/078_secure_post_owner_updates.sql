alter table public.posts enable row level security;

drop policy if exists posts_owner_update on public.posts;
create policy posts_owner_update on public.posts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists posts_owner_update_restrictive on public.posts;
create policy posts_owner_update_restrictive on public.posts
  as restrictive
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
