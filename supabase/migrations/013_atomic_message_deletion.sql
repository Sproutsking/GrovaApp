-- Atomic, owner-authorized message deletion for community and direct messages.
-- Each function enforces ownership in a single transaction and avoids races
-- caused by concurrent deletes or duplicate reactions.

create or replace function public.delete_community_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  with locked_message as (
    select id
    from public.community_messages
    where id = p_message_id
      and user_id = auth.uid()
      and deleted_at is null
    for update
  )
  update public.community_messages cm
  set deleted_at = now(),
      updated_at = now()
  from locked_message lm
  where cm.id = lm.id;

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.delete_direct_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_message_count integer;
  deleted_reaction_count integer;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  with locked_message as (
    select id
    from public.messages
    where id = p_message_id
      and sender_id = auth.uid()
    for update
  )
  delete from public.message_reactions mr
  using locked_message lm
  where mr.message_id = lm.id;
  get diagnostics deleted_reaction_count = row_count;

  with locked_message as (
    select id
    from public.messages
    where id = p_message_id
      and sender_id = auth.uid()
    for update
  )
  delete from public.messages m
  using locked_message lm
  where m.id = lm.id;
  get diagnostics deleted_message_count = row_count;

  return deleted_message_count = 1;
end;
$$;

revoke all on function public.delete_community_message(uuid) from public;
grant execute on function public.delete_community_message(uuid) to authenticated;
revoke all on function public.delete_direct_message(uuid) from public;
grant execute on function public.delete_direct_message(uuid) to authenticated;