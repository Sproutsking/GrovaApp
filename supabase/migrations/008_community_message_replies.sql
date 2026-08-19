alter table public.community_messages
  add column if not exists reply_to_id uuid references public.community_messages(id) on delete set null;

create index if not exists community_messages_reply_to_id_idx
  on public.community_messages(reply_to_id);