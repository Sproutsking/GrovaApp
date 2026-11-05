create or replace function public.xrc_append_event_v4_internal(
  p_record_id uuid,
  p_stream_type text,
  p_actor_id uuid,
  p_payload jsonb,
  p_idempotency_key text,
  p_source_operation text,
  p_event_schema_version integer
)
returns public.xrc_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_event_schema_version is distinct from 1 then
    raise exception 'Unsupported XRC event schema version';
  end if;

  return public.xrc_append_event_v4_internal(
    p_record_id,
    p_stream_type,
    p_actor_id,
    p_payload,
    p_idempotency_key,
    p_source_operation,
    p_event_schema_version::smallint
  );
end;
$$;

revoke all on function public.xrc_append_event_v4_internal(
  uuid, text, uuid, jsonb, text, text, integer
) from public, anon, authenticated;
