-- Live per-community moderation configuration, strikes, and case history.
alter table public.community_tool_settings drop constraint if exists community_tool_settings_tool_type_check;
alter table public.community_tool_settings add constraint community_tool_settings_tool_type_check check (tool_type in ('verification', 'social_updates', 'tickets', 'welcome', 'moderation'));

create table if not exists public.community_moderation_cases (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  moderator_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('warn','mute','kick','ban','delete')),
  reason text not null default 'Auto-moderation',
  strikes integer not null default 0,
  message_id uuid references public.community_messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists community_moderation_cases_lookup on public.community_moderation_cases(community_id, created_at desc);
create table if not exists public.community_moderation_strikes (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  strikes integer not null default 0,
  last_reason text,
  updated_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
alter table public.community_moderation_cases enable row level security;
alter table public.community_moderation_strikes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_moderation_cases' and policyname = 'community_moderation_cases_managers') then
    create policy community_moderation_cases_managers on public.community_moderation_cases for select using (exists (select 1 from public.communities c where c.id = community_moderation_cases.community_id and c.owner_id = auth.uid()) or moderator_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_moderation_strikes' and policyname = 'community_moderation_strikes_managers') then
    create policy community_moderation_strikes_managers on public.community_moderation_strikes for select using (user_id = auth.uid() or exists (select 1 from public.communities c where c.id = community_moderation_strikes.community_id and c.owner_id = auth.uid()));
  end if;
end $$;

create or replace function public.moderate_community_message(p_channel_id uuid, p_user_id uuid, p_content text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cfg jsonb := '{}'::jsonb; v_community_id uuid; strike_count integer := 0; action text := 'delete'; reason text := null; word text; upper_count integer; letter_count integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  select ch.community_id into v_community_id from public.community_channels ch where ch.id = p_channel_id and ch.deleted_at is null;
  select coalesce(config, '{}'::jsonb) into cfg from public.community_tool_settings where community_tool_settings.community_id = v_community_id and tool_type = 'moderation';
  if coalesce((cfg->>'enabled')::boolean, true) = false then return jsonb_build_object('allowed', true); end if;
  if coalesce((cfg->'filters'->'bannedWords'->>'enabled')::boolean, false) then
    foreach word in array string_to_array(regexp_replace(coalesce(cfg->'filters'->'bannedWords'->>'words',''), '\s*,\s*', E'\n', 'g'), E'\n') loop
      if length(trim(word)) > 0 and lower(p_content) like '%' || lower(trim(word)) || '%' then reason := 'Banned word'; exit; end if;
    end loop;
  end if;
  if reason is null and coalesce((cfg->'filters'->'invites'->>'enabled')::boolean, false) and p_content ~* '(discord\.gg/|discord\.com/invite/)' then reason := 'Invite link'; end if;
  if reason is null and coalesce((cfg->'filters'->'mentions'->>'enabled')::boolean, false) and (length(p_content) - length(replace(p_content, '@', ''))) > coalesce((cfg->'filters'->'mentions'->>'maxMentions')::integer, 5) then reason := 'Mass mentions'; end if;
  if reason is null and coalesce((cfg->'filters'->'caps'->>'enabled')::boolean, false) then
    upper_count := length(regexp_replace(p_content, '[^A-Z]', '', 'g')); letter_count := length(regexp_replace(p_content, '[^A-Za-z]', '', 'g'));
    if letter_count >= 8 and (upper_count::numeric / greatest(letter_count, 1)) * 100 >= coalesce((cfg->'filters'->'caps'->>'maxPercent')::numeric, 70) then reason := 'Excessive caps'; end if;
  end if;
  if reason is null then return jsonb_build_object('allowed', true); end if;
  insert into public.community_moderation_strikes(community_id, user_id, strikes, last_reason) values (v_community_id, p_user_id, 1, reason) on conflict (community_id,user_id) do update set strikes = community_moderation_strikes.strikes + 1, last_reason = excluded.last_reason, updated_at = now() returning strikes into strike_count;
  select coalesce((item->>'action'), 'warn') into action from jsonb_array_elements(coalesce(cfg->'escalation','[]'::jsonb)) item where (item->>'strikes')::integer <= strike_count order by (item->>'strikes')::integer desc limit 1;
  insert into public.community_moderation_cases(community_id,target_user_id,moderator_user_id,action,reason,strikes) values (v_community_id,p_user_id,null,action,reason,strike_count);
  return jsonb_build_object('allowed', false, 'action', action, 'reason', reason, 'strikes', strike_count);
end; $$;
revoke all on function public.moderate_community_message(uuid, uuid, text) from public;
grant execute on function public.moderate_community_message(uuid, uuid, text) to authenticated;

create or replace function public.log_community_moderation_case(p_community_id uuid, p_target_user_id uuid, p_action text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare is_manager boolean; strike_count integer := 0; case_id uuid;
begin
  select exists(select 1 from public.communities c where c.id=p_community_id and c.owner_id=auth.uid()) into is_manager;
  if not is_manager then return jsonb_build_object('success',false,'error','Moderation permission required'); end if;
  if p_action not in ('warn','mute','kick','ban','delete') then return jsonb_build_object('success',false,'error','Invalid moderation action'); end if;
  insert into public.community_moderation_strikes(community_id,user_id,strikes,last_reason) values(p_community_id,p_target_user_id,1,p_reason) on conflict(community_id,user_id) do update set strikes=community_moderation_strikes.strikes+1,last_reason=excluded.last_reason,updated_at=now() returning strikes into strike_count;
  insert into public.community_moderation_cases(community_id,target_user_id,moderator_user_id,action,reason,strikes) values(p_community_id,p_target_user_id,auth.uid(),p_action,coalesce(nullif(trim(p_reason),''),'Manual moderation'),strike_count) returning id into case_id;
  return jsonb_build_object('success',true,'case_id',case_id,'strikes',strike_count);
end; $$;
revoke all on function public.log_community_moderation_case(uuid,uuid,text,text) from public;
grant execute on function public.log_community_moderation_case(uuid,uuid,text,text) to authenticated;

create or replace function public.send_community_message(
  p_channel_id uuid,
  p_user_id uuid,
  p_content text,
  p_reply_to_id uuid default null
)
returns public.community_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  new_message public.community_messages;
  moderation_result jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  if nullif(trim(p_content), '') is null then raise exception 'Message cannot be empty'; end if;
  if not exists (select 1 from public.community_members m join public.community_channels ch on ch.community_id = m.community_id where m.user_id = p_user_id and ch.id = p_channel_id and ch.deleted_at is null) then raise exception 'You are not a member of this community'; end if;
  moderation_result := public.moderate_community_message(p_channel_id, p_user_id, trim(p_content));
  if coalesce((moderation_result->>'allowed')::boolean, true) = false then raise exception 'Message blocked by moderation: %', coalesce(moderation_result->>'reason', 'community rule'); end if;
  insert into public.community_messages (channel_id, user_id, content, reply_to_id) values (p_channel_id, p_user_id, trim(p_content), p_reply_to_id) returning * into new_message;
  return new_message;
end;
$$;
revoke all on function public.send_community_message(uuid, uuid, text, uuid) from public;
grant execute on function public.send_community_message(uuid, uuid, text, uuid) to authenticated;
