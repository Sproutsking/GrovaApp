create table if not exists public.hidden_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now()
);

delete from public.hidden_conversations older
using public.hidden_conversations newer
where older.conversation_id = newer.conversation_id
  and older.user_id = newer.user_id
  and older.hidden_at < newer.hidden_at;

create unique index if not exists hidden_conversations_user_conversation_uidx
  on public.hidden_conversations(user_id, conversation_id);

alter table public.hidden_conversations enable row level security;

drop policy if exists hidden_conversations_select_own on public.hidden_conversations;
create policy hidden_conversations_select_own
  on public.hidden_conversations for select to authenticated
  using (user_id = auth.uid());

drop policy if exists hidden_conversations_insert_own on public.hidden_conversations;
create policy hidden_conversations_insert_own
  on public.hidden_conversations for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists hidden_conversations_update_own on public.hidden_conversations;
create policy hidden_conversations_update_own
  on public.hidden_conversations for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists hidden_conversations_delete_own on public.hidden_conversations;
create policy hidden_conversations_delete_own
  on public.hidden_conversations for delete to authenticated
  using (user_id = auth.uid());
