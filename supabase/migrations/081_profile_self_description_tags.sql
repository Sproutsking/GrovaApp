alter table public.profiles
  add column if not exists profile_tags text[] not null default '{}';

alter table public.profiles
  drop constraint if exists profiles_profile_tags_check;

alter table public.profiles
  add constraint profiles_profile_tags_check
  check (
    cardinality(profile_tags) <= 5
    and profile_tags <@ array[
      'creator',
      'founder',
      'builder',
      'artist',
      'designer',
      'developer',
      'educator',
      'entrepreneur',
      'researcher',
      'writer',
      'community leader'
    ]::text[]
  );
