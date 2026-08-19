-- Community settings used by the appearance editor.

alter table public.communities
  add column if not exists background_theme text not null default 'security';

alter table public.communities
  add column if not exists banner_gradient text;

alter table public.communities
  add column if not exists icon_border text not null default 'default';