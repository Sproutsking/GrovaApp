alter table public.xrc_records
  add column if not exists is_public boolean not null default false;

create index if not exists xrc_records_public_actor_timestamp_idx
  on public.xrc_records(actor_id, timestamp desc)
  where is_public is true;

create or replace function public.set_xrc_record_visibility(
  p_record_id uuid,
  p_is_public boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to change XRC record visibility';
  end if;

  if p_record_id is null or p_is_public is null then
    raise exception 'A record and visibility value are required';
  end if;

  update public.xrc_records
  set is_public = p_is_public
  where record_id = p_record_id
    and actor_id = auth.uid();

  if not found then
    raise exception 'XRC record not found or not owned by the current user';
  end if;

  return true;
end;
$$;

revoke all on function public.set_xrc_record_visibility(uuid, boolean) from public, anon;
grant execute on function public.set_xrc_record_visibility(uuid, boolean) to authenticated;

drop function if exists public.get_xrd_public_xrc_events(uuid, uuid);

create function public.get_xrd_public_xrc_events(
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
  stream_sequence bigint,
  is_public boolean
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
      record.stream_sequence,
      record.is_public
    from public.xrc_records record
    where record.actor_id = p_profile_id
      and record.is_public is true
      and (p_xrd_record_id is null or record.payload->>'entity_id' = p_xrd_record_id::text)
    order by record.timestamp desc
    limit 100;
end;
$$;

revoke all on function public.get_xrd_public_xrc_events(uuid, uuid) from public, anon;
grant execute on function public.get_xrd_public_xrc_events(uuid, uuid) to authenticated;
