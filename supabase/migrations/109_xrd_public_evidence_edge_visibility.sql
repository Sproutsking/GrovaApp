drop policy if exists "Authenticated users can read relevant evidence edges" on public.evidence_edges;
create policy "Authenticated users can read relevant evidence edges"
  on public.evidence_edges for select to authenticated
  using (
    auth.role() = 'service_role'
    or (
      coalesce(lower(metadata->>'visibility'), 'public') = 'public'
      and exists (
        select 1 from public.evidence_items source_item
        where source_item.id = evidence_edges.source_id
      )
      and exists (
        select 1 from public.evidence_items target_item
        where target_item.id = evidence_edges.target_id
      )
    )
  );
