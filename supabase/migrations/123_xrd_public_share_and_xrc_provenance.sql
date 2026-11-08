create or replace function public.get_public_xrd_share(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with target as (
    select p.id, p.full_name, p.username, p.bio, p.avatar_id, p.created_at
    from public.profiles p
    where lower(ltrim(trim(p.username), '@')) = lower(ltrim(trim(p_username), '@'))
      and p.deleted_at is null
    limit 1
  )
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', target.id,
      'fullName', target.full_name,
      'username', target.username,
      'bio', target.bio,
      'avatarId', target.avatar_id,
      'createdAt', target.created_at
    ),
    'identityDetails', coalesce((
      select jsonb_object_agg(detail.field_key, detail.value)
      from public.xrd_identity_details detail
      where detail.profile_id = target.id
        and detail.visibility = 'public'
        and detail.field_key in ('headline', 'bio', 'location', 'pronouns', 'website', 'note', 'availability')
        and detail.value <> ''
    ), '{}'::jsonb),
    'claims', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', claim.id,
          'profile_id', claim.profile_id,
          'record_type', claim.record_type,
          'title', claim.title,
          'claim_text', claim.claim_text,
          'structured_claim', jsonb_strip_nulls(jsonb_build_object(
            'role', claim.structured_claim->'role',
            'organization', claim.structured_claim->'organization',
            'startDate', claim.structured_claim->'startDate',
            'endDate', claim.structured_claim->'endDate',
            'projectUrl', case
              when claim.structured_claim->>'projectUrl' ~* '^https?://' then claim.structured_claim->'projectUrl'
              else null
            end
          )),
          'lifecycle_status', claim.lifecycle_status,
          'visibility', claim.visibility,
          'created_at', claim.created_at,
          'evidence_links', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', link.id,
              'evidence_item_id', evidence.id,
              'relation', link.relation
            ) order by link.created_at)
            from public.xrd_record_evidence link
            join public.evidence_items evidence
              on evidence.id = link.evidence_item_id
             and evidence.profile_id = target.id
             and evidence.verified is true
             and coalesce(upper(evidence.metadata->>'visibility'), 'PUBLIC') = 'PUBLIC'
            where link.record_id = claim.id
          ), '[]'::jsonb)
        ) order by claim.created_at desc
      )
      from public.xrd_records claim
      where claim.profile_id = target.id
        and claim.lifecycle_status = 'published'
        and claim.visibility = 'public'
    ), '[]'::jsonb),
    'evidenceItems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', evidence.id,
        'profile_id', evidence.profile_id,
        'provider', evidence.provider,
        'evidence_type', evidence.evidence_type,
        'entity_type', evidence.entity_type,
        'title', evidence.title,
        'summary', evidence.summary,
        'description', evidence.description,
        'url', evidence.url,
        'source', evidence.source,
        'verified', evidence.verified,
        'confidence', evidence.confidence,
        'metadata', jsonb_strip_nulls(jsonb_build_object(
          'visibility', evidence.metadata->'visibility',
          'status', evidence.metadata->'status',
          'username', evidence.metadata->'username',
          'handle', evidence.metadata->'handle',
          'avatarUrl', evidence.metadata->'avatarUrl',
          'avatar_url', evidence.metadata->'avatar_url',
          'profile_image_url', evidence.metadata->'profile_image_url',
          'profileImageUrl', evidence.metadata->'profileImageUrl',
          'entityType', evidence.metadata->'entityType',
          'entity_type', evidence.metadata->'entity_type',
          'institution', evidence.metadata->'institution'
        )),
        'created_at', evidence.created_at,
        'updated_at', evidence.updated_at
      ) order by evidence.created_at desc)
      from public.evidence_items evidence
      where evidence.profile_id = target.id
        and evidence.verified is true
        and coalesce(upper(evidence.metadata->>'visibility'), 'PUBLIC') = 'PUBLIC'
    ), '[]'::jsonb),
    'bindings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', binding.id,
        'provider', binding.provider,
        'binding_method', binding.binding_method,
        'assurance_scope', binding.assurance_scope,
        'status', binding.status,
        'visibility', binding.visibility,
        'evidence_id', case when exists (
          select 1
          from public.evidence_items evidence
          where evidence.id = binding.evidence_id
            and evidence.profile_id = target.id
            and evidence.verified is true
            and coalesce(upper(evidence.metadata->>'visibility'), 'PUBLIC') = 'PUBLIC'
        ) then binding.evidence_id else null end,
        'created_at', binding.created_at,
        'updated_at', binding.updated_at
      ) order by binding.created_at desc)
      from public.xrd_identity_bindings binding
      where binding.profile_id = target.id
        and binding.visibility = 'public'
        and binding.status in ('claimed', 'pending', 'bound', 'verified')
    ), '[]'::jsonb)
  )
  from target;
$$;

revoke all on function public.get_public_xrd_share(text) from public;
grant execute on function public.get_public_xrd_share(text) to anon, authenticated;

create index if not exists xrc_records_xrd_entity_idx
  on public.xrc_records(actor_id, stream_type, (payload->>'entity_id'))
  where payload->>'entity_type' = 'xrd_record';

create or replace function public.get_xrd_public_xrc_events(
  p_profile_id uuid,
  p_xrd_record_id uuid default null
)
returns table (
  record_id uuid,
  stream_type text,
  previous_hash text,
  record_hash text,
  actor_id uuid,
  payload jsonb,
  "timestamp" bigint,
  signature text,
  version smallint,
  created_at timestamptz,
  event_schema_version smallint,
  idempotency_key text,
  source_operation text,
  stream_sequence bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to inspect XRC provenance';
  end if;

  if p_profile_id is null then
    raise exception 'A profile is required to inspect XRC provenance';
  end if;

  return query
    select
      record.record_id,
      record.stream_type,
      record.previous_hash,
      record.record_hash,
      record.actor_id,
      record.payload,
      record.timestamp,
      record.signature,
      record.version,
      record.created_at,
      record.event_schema_version::smallint,
      record.idempotency_key,
      record.source_operation,
      record.stream_sequence
    from public.xrc_records record
    join public.xrd_records claim
      on claim.id::text = record.payload->>'entity_id'
     and claim.profile_id = record.actor_id
     and claim.lifecycle_status = 'published'
     and claim.visibility = 'public'
    where record.actor_id = p_profile_id
      and record.stream_type in ('XDRC', 'XCRC')
      and record.payload->>'entity_type' = 'xrd_record'
      and record.payload->>'event' in (
        'xrd_claim_created',
        'xrd_evidence_supports',
        'xrd_evidence_contradicts'
      )
      and record.payload - array['event', 'entity_type', 'entity_id'] = '{}'::jsonb
      and (p_xrd_record_id is null or claim.id = p_xrd_record_id)
    order by record.timestamp desc
    limit 100;
end;
$$;

revoke all on function public.get_xrd_public_xrc_events(uuid, uuid) from public, anon;
grant execute on function public.get_xrd_public_xrc_events(uuid, uuid) to authenticated;
