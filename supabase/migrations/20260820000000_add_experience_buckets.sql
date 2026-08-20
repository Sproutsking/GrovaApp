-- Isolate content and communities by the active Xeevia environment.
alter table public.posts
  add column if not exists experience_id text not null default 'xeevia';

alter table public.reels
  add column if not exists experience_id text not null default 'xeevia';

alter table public.stories
  add column if not exists experience_id text not null default 'xeevia';

alter table public.communities
  add column if not exists experience_id text not null default 'xeevia';

create index if not exists posts_experience_created_at_idx
  on public.posts (experience_id, created_at desc);

create index if not exists reels_experience_created_at_idx
  on public.reels (experience_id, created_at desc);

create index if not exists stories_experience_created_at_idx
  on public.stories (experience_id, created_at desc);

create index if not exists communities_experience_created_at_idx
  on public.communities (experience_id, created_at desc);
