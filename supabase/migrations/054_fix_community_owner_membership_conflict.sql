-- Community creation can be retried by the client. Keep owner membership
-- idempotent so a retry or an existing membership trigger cannot abort the RPC.
create or replace function public.create_community_with_defaults(
  p_name text,
  p_description text,
  p_icon text,
  p_banner_gradient text,
  p_is_private boolean,
  p_owner_id uuid
)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  new_community public.communities;
  owner_role uuid;
  novis_role uuid;
  member_role uuid;
  verification_channel uuid;
begin
  if auth.uid() is null or auth.uid() <> p_owner_id then raise exception 'Unauthorized'; end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) < 3 then
    raise exception 'Community name must be at least 3 characters';
  end if;

  insert into public.communities (name, description, icon, banner_gradient, is_private, owner_id, member_count, online_count)
  values (trim(p_name), coalesce(p_description, ''), coalesce(p_icon, '🌟'), coalesce(p_banner_gradient, 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'), coalesce(p_is_private, false), p_owner_id, 1, 1)
  returning * into new_community;

  insert into public.community_roles (community_id, name, color, position, permissions, is_default)
  values (new_community.id, 'Owner', '#FFD700', 0, jsonb_build_object('sendMessages', true, 'manageChannels', true, 'manageMessages', true, 'manageCommunity', true, 'manageRoles', true, 'administrator', true, 'createChannels', true, 'viewChannels', true, 'viewMembers', true), false)
  returning id into owner_role;
  insert into public.community_roles (community_id, name, color, position, permissions, is_default)
  values (new_community.id, 'Member', '#667eea', 1, jsonb_build_object('sendMessages', true, 'viewChannels', true, 'viewMembers', true, 'readMessageHistory', true, 'addReactions', true), false)
  returning id into member_role;
  insert into public.community_roles (community_id, name, color, position, permissions, is_default)
  values (new_community.id, 'Novis', '#95A5A6', 2, jsonb_build_object('viewChannels', true, 'viewMembers', true, 'readMessageHistory', true), true)
  returning id into novis_role;

  insert into public.community_members (community_id, user_id, role_id, is_online, last_seen)
  values (new_community.id, p_owner_id, owner_role, true, now())
  on conflict (community_id, user_id) do update
    set role_id = excluded.role_id, is_online = true, last_seen = now();

  insert into public.community_channels (community_id, name, icon, description, type, tool_type, position, is_default, integrations)
  values
    (new_community.id, 'verification', '✅', 'Verify yourself to access the community', 'text', 'verification', 0, true, '{}'),
    (new_community.id, 'announcements', '📢', 'Official community announcements', 'announcement', null, 1, true, '{}'),
    (new_community.id, 'welcome', '👋', 'Welcome new members', 'text', null, 2, true, '{}'),
    (new_community.id, 'voice', '🔊', 'Voice conversations', 'voice', null, 3, true, '{}'),
    (new_community.id, 'support', '🛟', 'Get help from the community team', 'text', null, 4, true, '{}'),
    (new_community.id, 'general', '💬', 'General discussion', 'text', null, 5, true, '{}'),
    (new_community.id, 'updates', '✦', 'Xeevia and connected social updates', 'text', 'social_updates', 6, true, '{"xeevia": true}');

  select id into verification_channel from public.community_channels where community_id = new_community.id and tool_type = 'verification' limit 1;
  insert into public.community_tool_settings (community_id, tool_type, enabled, channel_id)
  values
    (new_community.id, 'verification', true, verification_channel),
    (new_community.id, 'social_updates', false, null),
    (new_community.id, 'tickets', false, null)
  on conflict (community_id, tool_type) do nothing;

  return new_community;
end;
$$;

alter function public.create_community_with_defaults(text, text, text, text, boolean, uuid) owner to postgres;
revoke all on function public.create_community_with_defaults(text, text, text, text, boolean, uuid) from public;
grant execute on function public.create_community_with_defaults(text, text, text, text, boolean, uuid) to authenticated;