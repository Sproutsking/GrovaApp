alter table public.community_roles
  add column if not exists icon text not null default '♟';