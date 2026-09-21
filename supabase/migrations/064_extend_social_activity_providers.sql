-- Extend inbound social activity routing for providers added after the first rollout.
alter table public.community_social_connections
  drop constraint if exists community_social_connections_provider_check;

alter table public.community_social_connections
  add constraint community_social_connections_provider_check
  check (provider in ('xeevia', 'x', 'facebook', 'instagram', 'tiktok', 'discord', 'youtube', 'twitch', 'snapchat', 'linkedin', 'kick', 'reddit', 'telegram', 'github'));
