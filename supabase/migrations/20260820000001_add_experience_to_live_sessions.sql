-- Keep live/trending activity inside the active environment.
alter table public.live_sessions
  add column if not exists experience_id text not null default 'xeevia';

create index if not exists live_sessions_experience_status_idx
  on public.live_sessions (experience_id, status, peak_viewers desc);
