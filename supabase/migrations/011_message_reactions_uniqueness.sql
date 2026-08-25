-- Keep one DM reaction per user and emoji before enforcing idempotency.
delete from public.message_reactions older
using public.message_reactions newer
where older.message_id = newer.message_id
  and older.user_id = newer.user_id
  and older.emoji = newer.emoji
  and older.id > newer.id;

create unique index if not exists message_reactions_message_user_emoji_idx
  on public.message_reactions(message_id, user_id, emoji);
