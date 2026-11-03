create or replace function public.delete_own_story(p_story_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to delete a story';
  end if;

  update public.stories
  set deleted_at = coalesce(deleted_at, now())
  where id = p_story_id
    and user_id = auth.uid();

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

alter function public.delete_own_story(uuid) owner to postgres;
revoke all on function public.delete_own_story(uuid) from public;
grant execute on function public.delete_own_story(uuid) to authenticated;
