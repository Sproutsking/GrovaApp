-- Make welcome delivery durable and let the client resolve live member/profile state.
-- The marker is idempotent: one welcome card per member per configured channel.

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
  welcome_content text;
begin
  select * into welcome_setting
  from public.community_tool_settings
  where community_id = new.community_id
    and tool_type = 'welcome'
    and enabled = true;

  if not found or welcome_setting.channel_id is null then
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

  select communities.owner_id into owner_id
  from public.communities
  where communities.id = new.community_id;

  if owner_id is null then
    return new;
  end if;

  if exists (
    select 1 from public.community_messages
    where channel_id = welcome_channel.id
      and content like format('[[welcome-member:%s]]%%', new.user_id)
      and deleted_at is null
  ) then
    return new;
  end if;

  welcome_content := format('[[welcome-member:%s]]', new.user_id);
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
    format('[[welcome-member:%s]]', members.user_id),
    coalesce(members.joined_at, now()),
    coalesce(members.joined_at, now())
  from public.community_tool_settings settings
  join public.communities communities on communities.id = settings.community_id
  join public.community_channels channels on channels.id = settings.channel_id
    and channels.community_id = settings.community_id
    and channels.deleted_at is null
    and channels.type <> 'voice'
  join public.community_members members on members.community_id = settings.community_id
  where settings.tool_type = 'welcome'
    and settings.enabled = true
    and communities.owner_id is not null
    and not exists (
      select 1
      from public.community_messages existing
      where existing.channel_id = settings.channel_id
        and existing.deleted_at is null
        and (
          existing.content like format('[[welcome-member:%s]]%%', members.user_id)
          or existing.content like format('%%Welcome %s!%%', coalesce('@' || nullif((select username from public.profiles where id = members.user_id), ''), (select full_name from public.profiles where id = members.user_id), 'new member'))
        )
    );
exception
  when others then
    raise warning 'Community welcome backfill skipped: %', sqlerrm;
end;
$$;
