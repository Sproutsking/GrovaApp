-- Community icon storage and appearance metadata.

insert into storage.buckets (id, name, public)
values ('community-assets', 'community-assets', true)
on conflict (id) do update set public = true;

create policy "Community assets are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'community-assets');

create policy "Authenticated users can upload community assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'community-assets');

create policy "Authenticated users can update community assets"
on storage.objects for update
to authenticated
using (bucket_id = 'community-assets')
with check (bucket_id = 'community-assets');

create policy "Authenticated users can delete community assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'community-assets');

alter table public.communities
  add column if not exists icon_border text not null default 'default';