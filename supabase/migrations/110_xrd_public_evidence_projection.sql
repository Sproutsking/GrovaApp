create or replace view public.xrd_public_evidence_items
with (security_invoker = true)
as
select
  id,
  profile_id,
  provider,
  evidence_type,
  entity_type,
  title,
  summary,
  description,
  url,
  source,
  verified,
  confidence,
  jsonb_strip_nulls(jsonb_build_object(
    'visibility', metadata->'visibility',
    'status', metadata->'status',
    'username', metadata->'username',
    'handle', metadata->'handle',
    'avatarUrl', metadata->'avatarUrl',
    'avatar_url', metadata->'avatar_url',
    'profile_image_url', metadata->'profile_image_url',
    'profileImageUrl', metadata->'profileImageUrl',
    'entityType', metadata->'entityType',
    'entity_type', metadata->'entity_type',
    'institution', metadata->'institution'
  )) as metadata,
  created_at,
  updated_at
from public.evidence_items
where verified = true
  and profile_id is not null
  and coalesce(upper(metadata->>'visibility'), 'PUBLIC') = 'PUBLIC';

grant select on public.xrd_public_evidence_items to authenticated;
