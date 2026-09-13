-- Persist channel update counts for members who have never opened a channel.
-- Existing preferences and notification modes remain respected.

create or replace function public.bump_channel_unread_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  message_community_id uuid;
begin
  select community_id
  into message_community_id
  from public.community_channels
  where id = new.channel_id;

  if message_community_id is null then
    return new;
  end if;

  insert into public.channel_notification_preferences (user_id, channel_id, mode, unread_count, updated_at)
  select member.user_id, new.channel_id, 'all', 0, now()
  from public.community_members member
  where member.community_id = message_community_id
    and member.user_id <> new.user_id
  on conflict (user_id, channel_id) do nothing;

  update public.channel_notification_preferences preferences
  set unread_count = preferences.unread_count + 1,
      updated_at = now()
  where preferences.channel_id = new.channel_id
    and preferences.user_id <> new.user_id
    and preferences.mode <> 'none';

  return new;
end;
$$;

alter function public.bump_channel_unread_count() owner to postgres;
revoke all on function public.bump_channel_unread_count() from public;
