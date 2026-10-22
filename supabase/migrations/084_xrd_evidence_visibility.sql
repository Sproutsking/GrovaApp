drop policy if exists "Authenticated users can read own or verified evidence" on public.evidence_items;
create policy "Authenticated users can read permitted evidence"
  on public.evidence_items for select to authenticated
  using (
    auth.role() = 'service_role'
    or profile_id = auth.uid()
    or (
      verified = true
      and coalesce(upper(metadata->>'visibility'), 'PUBLIC') = 'PUBLIC'
    )
  );

drop policy if exists "Owners can update evidence visibility" on public.evidence_items;
create policy "Owners can update evidence visibility"
  on public.evidence_items for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant update (metadata) on public.evidence_items to authenticated;