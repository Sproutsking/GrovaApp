-- Reliable direct-message writes, reciprocal blocking, reports, and preferences.

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  reason text not null default 'other',
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.messaging_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  read_receipts boolean not null default true,
  typing_indicators boolean not null default true,
  message_notifications boolean not null default true,
  media_auto_download boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_blocks enable row level security;
alter table public.message_reports enable row level security;
alter table public.messaging_preferences enable row level security;

drop policy if exists user_blocks_owner_select on public.user_blocks;
create policy user_blocks_owner_select on public.user_blocks for select using (auth.uid() = blocker_id);
drop policy if exists user_blocks_owner_write on public.user_blocks;
create policy user_blocks_owner_write on public.user_blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
drop policy if exists message_reports_owner_write on public.message_reports;
create policy message_reports_owner_write on public.message_reports for insert with check (auth.uid() = reporter_id);
drop policy if exists messaging_preferences_owner_access on public.messaging_preferences;
create policy messaging_preferences_owner_access on public.messaging_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.send_direct_message(
  p_conversation_id uuid,
  p_sender_id uuid,
  p_content text,
  p_reply_to_id uuid default null,
  p_media_url text default null,
  p_media_type text default null,
  p_attachments jsonb default '[]'::jsonb
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.conversations;
  recipient_id uuid;
  new_message public.messages;
begin
  if auth.uid() is null or auth.uid() <> p_sender_id then
    raise exception 'Unauthorized';
  end if;
  if nullif(trim(coalesce(p_content, '')), '') is null and jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) = 0 then
    raise exception 'Message cannot be empty';
  end if;

  select * into target from public.conversations where id = p_conversation_id;
  if not found or (target.user1_id <> p_sender_id and target.user2_id <> p_sender_id) then
    raise exception 'Conversation access denied';
  end if;
  recipient_id := case when target.user1_id = p_sender_id then target.user2_id else target.user1_id end;
  if exists (select 1 from public.user_blocks where blocker_id = recipient_id and blocked_id = p_sender_id)
     or exists (select 1 from public.user_blocks where blocker_id = p_sender_id and blocked_id = recipient_id) then
    raise exception 'Messaging is unavailable because one user is blocked';
  end if;

  insert into public.messages (conversation_id, sender_id, content, media_url, media_type, attachments, reply_to_id)
  values (p_conversation_id, p_sender_id, coalesce(nullif(trim(p_content), ''), 'Attachment'), p_media_url, p_media_type, coalesce(p_attachments, '[]'::jsonb), p_reply_to_id)
  returning * into new_message;
  update public.conversations set last_message_at = new_message.created_at, updated_at = now() where id = p_conversation_id;
  return new_message;
end;
$$;

revoke all on function public.send_direct_message(uuid, uuid, text, uuid, text, text, jsonb) from public;
grant execute on function public.send_direct_message(uuid, uuid, text, uuid, text, text, jsonb) to authenticated;