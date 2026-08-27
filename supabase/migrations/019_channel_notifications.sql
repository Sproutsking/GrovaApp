-- Per-user channel notification preferences and unread batches.
create table if not exists public.channel_notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  mode text not null default 'all' check (mode in ('all', 'mentions', 'none')),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

alter table public.channel_notification_preferences enable row level security;
drop policy if exists channel_notification_preferences_owner on public.channel_notification_preferences;
create policy channel_notification_preferences_owner on public.channel_notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.mark_channel_read(p_channel_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  insert into public.channel_notification_preferences(user_id, channel_id, mode, unread_count, last_read_at)
  values (auth.uid(), p_channel_id, 'all', 0, now())
  on conflict (user_id, channel_id) do update
    set unread_count = 0, last_read_at = now(), updated_at = now();
end;
$$;
grant execute on function public.mark_channel_read(uuid) to authenticated;

create or replace function public.bump_channel_unread_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.channel_notification_preferences
  set unread_count = unread_count + 1, updated_at = now()
  where channel_id = new.channel_id and user_id <> new.user_id and mode <> 'none';
  return new;
end;
$$;

drop trigger if exists community_message_notification_count on public.community_messages;
create trigger community_message_notification_count
after insert on public.community_messages
for each row execute function public.bump_channel_unread_count();
