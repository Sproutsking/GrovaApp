-- Preserve the exact public audio asset selected from the Sound Gallery.
alter table public.status_updates
  add column if not exists music_url text;