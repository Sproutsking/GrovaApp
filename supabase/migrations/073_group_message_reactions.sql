-- Persist group reactions atomically while allowing any group member to react.
create or replace function public.toggle_group_message_reaction(
  p_message_id uuid,
  p_emoji text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id text;
  v_reactions jsonb;
  v_users jsonb;
  v_previous text;
  v_count integer;
begin
  if v_user_id is null or p_message_id is null or p_emoji is null or char_length(p_emoji) = 0 or char_length(p_emoji) > 32 then
    raise exception 'A signed-in user, message, and valid emoji are required';
  end if;

  select gm.group_id, coalesce(gm.reactions, '{}'::jsonb)
    into v_group_id, v_reactions
    from public.group_messages gm
   where gm.id = p_message_id and gm.deleted_at is null
   for update;

  if not found then
    raise exception 'Group message not found';
  end if;

  if not exists (
    select 1
      from public.group_chats gc
     where gc.id = v_group_id
         and v_user_id = any(gc.member_ids)
  ) then
    raise exception 'Only group members can react to messages';
  end if;

  v_users := coalesce(v_reactions->'_users', '{}'::jsonb);
  v_previous := v_users->>v_user_id::text;

  if v_previous = p_emoji then
    v_users := v_users - v_user_id::text;
    v_count := greatest(0, coalesce((v_reactions->>p_emoji)::integer, 0) - 1);
    if v_count = 0 then
      v_reactions := v_reactions - p_emoji;
    else
      v_reactions := jsonb_set(v_reactions, array[p_emoji], to_jsonb(v_count), true);
    end if;
  else
    if v_previous is not null then
      v_count := greatest(0, coalesce((v_reactions->>v_previous)::integer, 0) - 1);
      if v_count = 0 then
        v_reactions := v_reactions - v_previous;
      else
        v_reactions := jsonb_set(v_reactions, array[v_previous], to_jsonb(v_count), true);
      end if;
    end if;

    v_count := coalesce((v_reactions->>p_emoji)::integer, 0) + 1;
    v_reactions := jsonb_set(v_reactions, array[p_emoji], to_jsonb(v_count), true);
    v_users := jsonb_set(v_users, array[v_user_id::text], to_jsonb(p_emoji), true);
  end if;

  v_reactions := jsonb_set(v_reactions, '{_users}', v_users, true);

  update public.group_messages
     set reactions = v_reactions, updated_at = now()
   where id = p_message_id;

  return v_reactions;
end;
$$;

revoke all on function public.toggle_group_message_reaction(uuid, text) from public;
grant execute on function public.toggle_group_message_reaction(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'group_messages'
  ) then
    alter publication supabase_realtime add table public.group_messages;
  end if;
end;
$$;