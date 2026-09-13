-- Make community tools executable across every join path.
-- The membership trigger covers public joins, invite joins, and future clients.

alter table public.community_channels
  drop constraint if exists community_channels_tool_type_check;

alter table public.community_channels
  add constraint community_channels_tool_type_check
  check (tool_type is null or tool_type in ('verification', 'social_updates', 'tickets', 'welcome', 'moderation'));

alter table public.community_tool_settings
  drop constraint if exists community_tool_settings_tool_type_check;

alter table public.community_tool_settings
  add constraint community_tool_settings_tool_type_check
  check (tool_type in ('verification', 'social_updates', 'tickets', 'welcome', 'moderation'));

create or replace function public.run_community_welcome_tool()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  welcome_setting public.community_tool_settings;
  welcome_channel public.community_channels;
  owner_id uuid;
  member_username text;
  member_name text;
  welcome_title text;
  welcome_description text;
  welcome_content text;
begin
  select * into welcome_setting
  from public.community_tool_settings
  where community_id = new.community_id
    and tool_type = 'welcome'
    and enabled = true;

  if not found then
    return new;
  end if;

  select * into welcome_channel
  from public.community_channels
  where id = welcome_setting.channel_id
    and community_id = new.community_id
    and deleted_at is null
    and type <> 'voice';

  if not found then
    return new;
  end if;

  select c.owner_id into owner_id
  from public.communities c
  where c.id = new.community_id;

  if owner_id is null then
    return new;
  end if;

  select p.username, coalesce(nullif(p.full_name, ''), p.username, 'new member')
  into member_username, member_name
  from public.profiles p
  where p.id = new.user_id;

  welcome_title := coalesce(nullif(trim(welcome_setting.config->>'title'), ''), 'Welcome to our community');
  welcome_description := coalesce(nullif(trim(welcome_setting.config->>'description'), ''), 'Introduce yourself and join the conversation.');
  welcome_content := format('%s\n\n%s\n\nWelcome %s! Please introduce yourself and join the conversation.', welcome_title, welcome_description, coalesce('@' || nullif(member_username, ''), member_name));

  insert into public.community_messages (channel_id, user_id, content)
  values (welcome_channel.id, owner_id, welcome_content);

  return new;
exception
  when others then
    -- A welcome post must never make a valid membership join fail.
    raise warning 'Community welcome automation skipped for community %: %', new.community_id, sqlerrm;
    return new;
end;
$$;

alter function public.run_community_welcome_tool() owner to postgres;
revoke all on function public.run_community_welcome_tool() from public;

drop trigger if exists community_member_welcome_tool on public.community_members;
create trigger community_member_welcome_tool
after insert on public.community_members
for each row execute function public.run_community_welcome_tool();

create index if not exists community_tool_settings_welcome_lookup_idx
  on public.community_tool_settings(community_id, tool_type, enabled, channel_id);
