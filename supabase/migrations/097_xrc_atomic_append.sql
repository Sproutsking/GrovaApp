create table if not exists public.xrc_records (
  record_id uuid primary key default gen_random_uuid(),
  stream_type text not null check (stream_type in ('XTRC', 'XERC', 'XARC', 'XCRC', 'XPRC', 'XSRC', 'XWRC')),
  previous_hash text not null,
  record_hash text not null unique,
  actor_id uuid not null references public.profiles(id),
  payload jsonb not null default '{}'::jsonb,
  timestamp bigint not null,
  signature text,
  version smallint not null default 3,
  created_at timestamptz not null default now()
);

alter table public.xrc_records alter column version set default 3;
create index if not exists xrc_records_actor_timestamp_idx on public.xrc_records(actor_id, timestamp desc);
create index if not exists xrc_records_stream_timestamp_idx on public.xrc_records(stream_type, timestamp asc);

create table if not exists public.xrc_root_chain (
  stream_type text primary key check (stream_type in ('XTRC', 'XERC', 'XARC', 'XCRC', 'XPRC', 'XSRC', 'XWRC')),
  current_head_hash text not null,
  last_record_id uuid references public.xrc_records(record_id),
  record_count bigint not null default 0,
  last_updated_at timestamptz not null default now()
);

alter table public.xrc_records enable row level security;
alter table public.xrc_root_chain enable row level security;
revoke all on table public.xrc_records from anon;
revoke all on table public.xrc_root_chain from anon;
grant select on public.xrc_records to authenticated;
grant select on public.xrc_root_chain to authenticated;

drop policy if exists "XRC actors can read own events" on public.xrc_records;
create policy "XRC actors can read own events" on public.xrc_records
  for select to authenticated using (actor_id = auth.uid());

drop policy if exists "Authenticated users can read XRC stream heads" on public.xrc_root_chain;
create policy "Authenticated users can read XRC stream heads" on public.xrc_root_chain
  for select to authenticated using (true);

create or replace function public.append_xrc_record(
  p_record_id uuid,
  p_stream_type text,
  p_previous_hash text,
  p_record_hash text,
  p_actor_id uuid,
  p_payload jsonb,
  p_timestamp bigint,
  p_version smallint,
  p_created_at timestamptz,
  p_genesis_hash text
)
returns setof public.xrc_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_head public.xrc_root_chain%rowtype;
  inserted_record public.xrc_records%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_actor_id then
    raise exception 'XRC actor must match the authenticated user';
  end if;
  if p_version <> 3 then
    raise exception 'Unsupported XRC record version';
  end if;
  if p_record_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'XRC record hash must be lowercase SHA-256 hex';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_stream_type, 0));

  select * into current_head
    from public.xrc_root_chain
    where stream_type = p_stream_type
    for update;

  if not found then
    if p_previous_hash <> p_genesis_hash then
      raise exception 'XRC chain head changed; retry append';
    end if;
    insert into public.xrc_root_chain(stream_type, current_head_hash, record_count)
      values (p_stream_type, p_genesis_hash, 0);
    select * into current_head from public.xrc_root_chain where stream_type = p_stream_type for update;
  end if;

  if current_head.current_head_hash <> p_previous_hash then
    raise exception 'XRC chain head changed; retry append';
  end if;

  insert into public.xrc_records(
    record_id, stream_type, previous_hash, record_hash, actor_id, payload, timestamp, version, created_at
  ) values (
    p_record_id, p_stream_type, p_previous_hash, p_record_hash, p_actor_id,
    coalesce(p_payload, '{}'::jsonb), p_timestamp, p_version, p_created_at
  ) returning * into inserted_record;

  update public.xrc_root_chain
    set current_head_hash = p_record_hash,
        last_record_id = p_record_id,
        record_count = record_count + 1,
        last_updated_at = now()
    where stream_type = p_stream_type;

  return next inserted_record;
end;
$$;

revoke all on function public.append_xrc_record(uuid, text, text, text, uuid, jsonb, bigint, smallint, timestamptz, text) from public, anon;
grant execute on function public.append_xrc_record(uuid, text, text, text, uuid, jsonb, bigint, smallint, timestamptz, text) to authenticated;