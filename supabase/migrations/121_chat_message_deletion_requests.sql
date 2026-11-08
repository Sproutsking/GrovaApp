create table if not exists public.chat_message_hides (
  message_kind text not null check (message_kind in ('direct', 'group', 'community')),
  conversation_id text not null,
  message_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_kind, conversation_id, message_id, user_id)
);

alter table public.chat_message_hides enable row level security;

drop policy if exists chat_message_hides_select_own on public.chat_message_hides;
create policy chat_message_hides_select_own
  on public.chat_message_hides for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.message_delete_requests (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  message_kind text not null check (message_kind in ('direct', 'group', 'community')),
  conversation_id text not null,
  message_id uuid not null,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (batch_id, message_id)
);

create index if not exists idx_message_delete_requests_author_pending
  on public.message_delete_requests (author_id, conversation_id, created_at desc)
  where status = 'pending';

create index if not exists idx_message_delete_requests_batch
  on public.message_delete_requests (batch_id, author_id);

alter table public.message_delete_requests enable row level security;

drop policy if exists message_delete_requests_participant_select on public.message_delete_requests;
create policy message_delete_requests_participant_select
  on public.message_delete_requests for select to authenticated
  using (requester_id = auth.uid() or author_id = auth.uid());

create or replace function public.get_hidden_chat_message_ids(
  p_message_kind text,
  p_conversation_id text
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_channel_id uuid;
  v_hidden_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_message_kind = 'direct' then
    if not exists (
      select 1 from public.conversations c
      where c.id = p_conversation_id::uuid
        and v_user_id in (c.user1_id, c.user2_id)
    ) then
      raise exception 'Conversation not found or access denied';
    end if;
  elsif p_message_kind = 'group' then
    if not exists (
      select 1 from public.group_chats g
      where g.id = p_conversation_id
        and v_user_id::text = any(g.member_ids)
    ) then
      raise exception 'Group not found or access denied';
    end if;
  elsif p_message_kind = 'community' then
    begin
      v_channel_id := p_conversation_id::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid channel';
    end;
    if not exists (
      select 1 from public.community_channels ch
      where ch.id = v_channel_id
        and public.community_user_can_access_channel(ch.community_id, v_user_id, ch.id, 'view')
    ) then
      raise exception 'Channel not found or access denied';
    end if;
  else
    raise exception 'Unsupported conversation type';
  end if;

  select coalesce(array_agg(h.message_id), '{}'::uuid[])
    into v_hidden_ids
    from public.chat_message_hides h
   where h.user_id = v_user_id
     and h.message_kind = p_message_kind
     and h.conversation_id = p_conversation_id;

  return v_hidden_ids;
end;
$$;

create or replace function public.submit_chat_message_deletion(
  p_message_kind text,
  p_conversation_id text,
  p_message_ids uuid[],
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_channel_id uuid;
  v_message_id uuid;
  v_author_id uuid;
  v_batch_id uuid := gen_random_uuid();
  v_deleted_ids uuid[] := '{}';
  v_requested_count integer := 0;
  v_hidden_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;
  if p_message_kind not in ('direct', 'group', 'community')
    or p_action not in ('for_me', 'everyone', 'request')
    or p_conversation_id is null
    or p_message_ids is null
    or cardinality(p_message_ids) = 0
    or cardinality(p_message_ids) > 100 then
    raise exception 'Invalid message deletion request';
  end if;

  if p_message_kind = 'direct' then
    if not exists (
      select 1 from public.conversations c
      where c.id = p_conversation_id::uuid
        and v_user_id in (c.user1_id, c.user2_id)
    ) then
      raise exception 'Conversation not found or access denied';
    end if;
  elsif p_message_kind = 'group' then
    if not exists (
      select 1 from public.group_chats g
      where g.id = p_conversation_id
        and v_user_id::text = any(g.member_ids)
    ) then
      raise exception 'Group not found or access denied';
    end if;
  else
    begin
      v_channel_id := p_conversation_id::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid channel';
    end;
    if not exists (
      select 1 from public.community_channels ch
      where ch.id = v_channel_id
        and public.community_user_can_access_channel(ch.community_id, v_user_id, ch.id, 'view')
    ) then
      raise exception 'Channel not found or access denied';
    end if;
  end if;

  for v_message_id in
    select distinct message_id from unnest(p_message_ids) as message_id
  loop
    if p_message_kind = 'direct' then
      select m.sender_id into v_author_id from public.messages m
      where m.id = v_message_id and m.conversation_id = p_conversation_id::uuid
      for update;
    elsif p_message_kind = 'group' then
      select m.user_id into v_author_id from public.group_messages m
      where m.id = v_message_id and m.group_id = p_conversation_id and m.deleted_at is null
      for update;
    else
      select m.user_id into v_author_id from public.community_messages m
      where m.id = v_message_id and m.channel_id = v_channel_id and m.deleted_at is null
      for update;
    end if;

    if v_author_id is null then
      raise exception 'A selected message is no longer available';
    end if;

    if p_action = 'for_me' then
      insert into public.chat_message_hides (message_kind, conversation_id, message_id, user_id)
      values (p_message_kind, p_conversation_id, v_message_id, v_user_id)
      on conflict do nothing;
      v_hidden_count := v_hidden_count + 1;
    elsif v_author_id = v_user_id then
      if p_message_kind = 'direct' then
        delete from public.message_reactions where message_id = v_message_id;
        delete from public.messages where id = v_message_id;
      elsif p_message_kind = 'group' then
        delete from public.group_messages where id = v_message_id and user_id = v_user_id;
      else
        update public.community_messages
           set deleted_at = now(), updated_at = now()
         where id = v_message_id and user_id = v_user_id and deleted_at is null;
      end if;
      v_deleted_ids := array_append(v_deleted_ids, v_message_id);
    elsif p_action = 'request' then
      insert into public.message_delete_requests (
        batch_id, message_kind, conversation_id, message_id, requester_id, author_id
      ) values (
        v_batch_id, p_message_kind, p_conversation_id, v_message_id, v_user_id, v_author_id
      );
      v_requested_count := v_requested_count + 1;
    else
      raise exception 'You can only delete your own messages for everyone';
    end if;
    v_author_id := null;
  end loop;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'deleted_ids', to_jsonb(v_deleted_ids),
    'requested_count', v_requested_count,
    'hidden_count', v_hidden_count
  );
end;
$$;

create or replace function public.get_pending_message_delete_requests(
  p_message_kind text,
  p_conversation_id text
)
returns table (
  id uuid,
  batch_id uuid,
  requester_id uuid,
  requester_name text,
  message_count bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_message_kind not in ('direct', 'group', 'community') then
    raise exception 'Invalid message deletion request';
  end if;

  return query
  select r.batch_id,
         r.batch_id,
         r.requester_id,
         coalesce(nullif(p.full_name, ''), nullif(p.username, ''), 'A member'),
         count(*)::bigint,
         min(r.created_at)
    from public.message_delete_requests r
    left join public.profiles p on p.id = r.requester_id
   where r.author_id = auth.uid()
     and r.message_kind = p_message_kind
     and r.conversation_id = p_conversation_id
     and r.status = 'pending'
   group by r.batch_id, r.requester_id, p.full_name, p.username
   order by min(r.created_at);
end;
$$;

create or replace function public.respond_to_message_delete_request(
  p_batch_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.message_delete_requests%rowtype;
  v_channel_id uuid;
  v_deleted_ids uuid[] := '{}';
begin
  if auth.uid() is null or p_batch_id is null or p_accept is null then
    raise exception 'Invalid message deletion response';
  end if;

  for v_request in
    select * from public.message_delete_requests r
    where r.batch_id = p_batch_id
      and r.author_id = auth.uid()
      and r.status = 'pending'
    for update
  loop
    if p_accept then
      if v_request.message_kind = 'direct' then
        delete from public.message_reactions where message_id = v_request.message_id;
        delete from public.messages
        where id = v_request.message_id
          and conversation_id = v_request.conversation_id::uuid
          and sender_id = auth.uid();
      elsif v_request.message_kind = 'group' then
        delete from public.group_messages
        where id = v_request.message_id
          and group_id = v_request.conversation_id
          and user_id = auth.uid();
      elsif v_request.message_kind = 'community' then
        v_channel_id := v_request.conversation_id::uuid;
        update public.community_messages
           set deleted_at = now(), updated_at = now()
         where id = v_request.message_id
           and channel_id = v_channel_id
           and user_id = auth.uid()
           and deleted_at is null;
      end if;

      if not found then
        raise exception 'A requested message is no longer available';
      end if;
      v_deleted_ids := array_append(v_deleted_ids, v_request.message_id);
    end if;

    update public.message_delete_requests
       set status = case when p_accept then 'approved' else 'declined' end,
           responded_at = now()
     where id = v_request.id;
  end loop;

  if not found then
    raise exception 'No pending deletion request was found';
  end if;

  return jsonb_build_object('deleted_ids', to_jsonb(v_deleted_ids), 'accepted', p_accept);
end;
$$;

revoke all on function public.get_hidden_chat_message_ids(text, text) from public;
revoke all on function public.submit_chat_message_deletion(text, text, uuid[], text) from public;
revoke all on function public.get_pending_message_delete_requests(text, text) from public;
revoke all on function public.respond_to_message_delete_request(uuid, boolean) from public;
grant execute on function public.get_hidden_chat_message_ids(text, text) to authenticated;
grant execute on function public.submit_chat_message_deletion(text, text, uuid[], text) to authenticated;
grant execute on function public.get_pending_message_delete_requests(text, text) to authenticated;
grant execute on function public.respond_to_message_delete_request(uuid, boolean) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'message_delete_requests'
    ) then
    alter publication supabase_realtime add table public.message_delete_requests;
  end if;
end;
$$;
