-- Make welcome delivery observable and backfill only members without a card.
-- The member marker makes this migration safe to run more than once.

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
  welcome_content := format('[[welcome-member:%s]]%s%s%s%s%sWelcome %s! Please introduce yourself and join the conversation.', new.user_id, E'\n', welcome_title, E'\n\n', welcome_description, E'\n\n', coalesce('@' || nullif(member_username, ''), member_name));

  insert into public.community_messages (channel_id, user_id, content)
  values (welcome_channel.id, owner_id, welcome_content);

  return new;
exception
  when others then
    raise warning 'Community welcome automation skipped for community %: %', new.community_id, sqlerrm;
    return new;
end;
$$;

alter function public.run_community_welcome_tool() owner to postgres;
revoke all on function public.run_community_welcome_tool() from public;

do $$
begin
  insert into public.community_messages (channel_id, user_id, content, created_at, updated_at)
  select
    settings.channel_id,
    communities.owner_id,
    format('[[welcome-member:%s]]%s%s%s%s%sWelcome %s! Please introduce yourself and join the conversation.', members.user_id, E'\n',
      coalesce(nullif(trim(settings.config->>'title'), ''), 'Welcome to our community'),
      E'\n\n',
      coalesce(nullif(trim(settings.config->>'description'), ''), 'Introduce yourself and join the conversation.'),
      E'\n\n',
      coalesce('@' || nullif(profiles.username, ''), profiles.full_name, 'new member')),
    members.joined_at,
    members.joined_at
  from public.community_tool_settings settings
  join public.communities communities on communities.id = settings.community_id
  join public.community_channels channels on channels.id = settings.channel_id
    and channels.community_id = settings.community_id
    and channels.deleted_at is null
    and channels.type <> 'voice'
  join public.community_members members on members.community_id = settings.community_id
  left join public.profiles profiles on profiles.id = members.user_id
  where settings.tool_type = 'welcome'
    and settings.enabled = true
    and communities.owner_id is not null
    and not exists (
      select 1
      from public.community_messages existing
      where existing.channel_id = settings.channel_id
        and (
          existing.content like format('[[welcome-member:%s]]%%', members.user_id)
          or (
            existing.content like '%Welcome %'
            and (
              (profiles.username is not null and existing.content like '%' || '@' || profiles.username || '%')
              or (profiles.full_name is not null and existing.content like '%' || profiles.full_name || '%')
            )
          )
        )
    );
exception
  when others then
    raise warning 'Community welcome backfill skipped: %', sqlerrm;
end;
$$;
