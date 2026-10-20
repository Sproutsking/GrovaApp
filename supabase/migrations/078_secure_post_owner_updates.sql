alter table public.posts enable row level security;

drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts
  for select to anon, authenticated
  using (deleted_at is null or (auth.uid() is not null and user_id = auth.uid()));

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

create or replace function public.delete_own_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to delete a post';
  end if;

  update public.posts
  set deleted_at = coalesce(deleted_at, now()),
      updated_at = now()
  where id = p_post_id
    and user_id = auth.uid();

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

alter function public.delete_own_post(uuid) owner to postgres;
revoke all on function public.delete_own_post(uuid) from public;
grant execute on function public.delete_own_post(uuid) to authenticated;
