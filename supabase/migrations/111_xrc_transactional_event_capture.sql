alter table public.xrc_records
  alter column actor_id drop not null,
  add column if not exists event_schema_version smallint,
  add column if not exists idempotency_key text,
  add column if not exists source_operation text,
  add column if not exists stream_sequence bigint;

alter table public.xrc_records
  drop constraint if exists xrc_records_stream_type_check;
alter table public.xrc_records
  add constraint xrc_records_stream_type_check
  check (stream_type in ('XTRC', 'XERC', 'XARC', 'XCRC', 'XPRC', 'XSRC', 'XWRC', 'XDRC'));

alter table public.xrc_root_chain
  drop constraint if exists xrc_root_chain_stream_type_check;
alter table public.xrc_root_chain
  add constraint xrc_root_chain_stream_type_check
  check (stream_type in ('XTRC', 'XERC', 'XARC', 'XCRC', 'XPRC', 'XSRC', 'XWRC', 'XDRC'));

create unique index if not exists xrc_records_idempotency_key_idx
  on public.xrc_records(idempotency_key)
  where idempotency_key is not null;

create unique index if not exists xrc_records_stream_sequence_idx
  on public.xrc_records(stream_type, stream_sequence)
  where stream_sequence is not null;

create or replace function public.xrc_canonical_jsonb(p_value jsonb)
returns text
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  result text;
  value_type text := jsonb_typeof(p_value);
begin
  if value_type = 'object' then
    select coalesce(
      '{' || string_agg(
        to_json(entry.key)::text || ':' || public.xrc_canonical_jsonb(entry.value),
        ',' order by entry.key collate "C"
      ) || '}',
      '{}'
    )
    into result
    from jsonb_each(p_value) as entry;
    return result;
  elsif value_type = 'array' then
    select coalesce(
      '[' || string_agg(public.xrc_canonical_jsonb(entry.value), ',' order by entry.ordinality) || ']',
      '[]'
    )
    into result
    from jsonb_array_elements(p_value) with ordinality as entry(value, ordinality);
    return result;
  elsif value_type = 'string' then
    return to_json(p_value #>> '{}')::text;
  elsif value_type = 'number' then
    return trim_scale((p_value #>> '{}')::numeric)::text;
  end if;
  return p_value::text;
end;
$$;

create or replace function public.xrc_append_event_v4_internal(
  p_record_id uuid,
  p_stream_type text,
  p_actor_id uuid,
  p_payload jsonb,
  p_idempotency_key text,
  p_source_operation text,
  p_event_schema_version smallint default 1
)
returns public.xrc_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_head public.xrc_root_chain%rowtype;
  inserted_record public.xrc_records%rowtype;
  event_time timestamptz := date_trunc('milliseconds', clock_timestamp());
  event_timestamp bigint := floor(extract(epoch from event_time) * 1000)::bigint;
  canonical_payload jsonb;
  hash_input jsonb;
  record_hash_value text;
begin
  if p_stream_type is null or p_stream_type not in ('XTRC', 'XERC', 'XARC', 'XCRC', 'XPRC', 'XSRC', 'XWRC', 'XDRC') then
    raise exception 'Unsupported XRC stream type: %', p_stream_type;
  end if;
  if p_record_id is null or nullif(trim(p_idempotency_key), '') is null
     or nullif(trim(p_source_operation), '') is null then
    raise exception 'XRC record, idempotency, and source-operation identifiers are required';
  end if;
  if p_event_schema_version <> 1 then
    raise exception 'Unsupported XRC event schema version';
  end if;
  if length(p_idempotency_key) > 240 or length(p_source_operation) > 120 then
    raise exception 'XRC idempotency key or source operation is too long';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('xrc-idempotency:' || p_idempotency_key, 0));

  select * into inserted_record
  from public.xrc_records
  where idempotency_key = p_idempotency_key;
  if found then
    if inserted_record.stream_type is distinct from p_stream_type
       or inserted_record.actor_id is distinct from p_actor_id
       or inserted_record.source_operation is distinct from p_source_operation
       or (inserted_record.payload - array[
         'event_schema_version', 'actor_id', 'source_operation',
         'occurred_at', 'outcome', 'idempotency_key'
       ]) is distinct from (coalesce(p_payload, '{}'::jsonb) - array[
         'event_schema_version', 'actor_id', 'source_operation',
         'occurred_at', 'outcome', 'idempotency_key'
       ]) then
      raise exception 'XRC idempotency key was already used for a different event';
    end if;
    return inserted_record;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('xrc-stream:' || p_stream_type, 0));

  select * into current_head
  from public.xrc_root_chain
  where stream_type = p_stream_type
  for update;

  if not found then
    insert into public.xrc_root_chain(stream_type, current_head_hash, record_count)
    values (
      p_stream_type,
      encode(extensions.digest(
        convert_to(
          '{"event":"genesis","stream_type":"' || p_stream_type || '","version":1}',
          'UTF8'
        ),
        'sha256'
      ), 'hex'),
      0
    );
    select * into current_head
    from public.xrc_root_chain
    where stream_type = p_stream_type
    for update;
  end if;

  canonical_payload := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
    'event_schema_version', p_event_schema_version,
    'actor_id', p_actor_id,
    'source_operation', p_source_operation,
    'occurred_at', to_char(event_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'outcome', 'committed',
    'idempotency_key', p_idempotency_key
  );

  hash_input := jsonb_build_object(
    'record_id', p_record_id,
    'stream_type', p_stream_type,
    'previous_hash', current_head.current_head_hash,
    'actor_id', p_actor_id,
    'payload', canonical_payload,
    'timestamp', event_timestamp,
    'version', 4,
    'created_at', to_char(event_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'event_schema_version', p_event_schema_version,
    'idempotency_key', p_idempotency_key,
    'source_operation', p_source_operation,
    'stream_sequence', current_head.record_count + 1
  );
  record_hash_value := encode(
    extensions.digest(convert_to(public.xrc_canonical_jsonb(hash_input), 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.xrc_records(
    record_id,
    stream_type,
    previous_hash,
    record_hash,
    actor_id,
    payload,
    timestamp,
    version,
    created_at,
    event_schema_version,
    idempotency_key,
    source_operation,
    stream_sequence
  )
  values (
    p_record_id,
    p_stream_type,
    current_head.current_head_hash,
    record_hash_value,
    p_actor_id,
    canonical_payload,
    event_timestamp,
    4,
    event_time,
    p_event_schema_version,
    p_idempotency_key,
    p_source_operation,
    current_head.record_count + 1
  )
  returning * into inserted_record;

  update public.xrc_root_chain
  set current_head_hash = record_hash_value,
      last_record_id = p_record_id,
      record_count = record_count + 1,
      last_updated_at = event_time
  where stream_type = p_stream_type;

  return inserted_record;
end;
$$;

revoke all on function public.xrc_canonical_jsonb(jsonb) from public, anon, authenticated;
revoke all on function public.xrc_append_event_v4_internal(uuid, text, uuid, jsonb, text, text, smallint) from public, anon, authenticated;

create or replace function public.append_xrc_record_v4(
  p_record_id uuid,
  p_stream_type text,
  p_actor_id uuid,
  p_payload jsonb,
  p_idempotency_key text,
  p_source_operation text
)
returns setof public.xrc_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or auth.uid() <> p_actor_id then
    raise exception 'XRC actor must match the authenticated user';
  end if;
  return next public.xrc_append_event_v4_internal(
    p_record_id,
    p_stream_type,
    p_actor_id,
    p_payload,
    p_idempotency_key,
    p_source_operation,
    1::smallint
  );
end;
$$;

revoke all on function public.append_xrc_record_v4(uuid, text, uuid, jsonb, text, text) from public, anon;
grant execute on function public.append_xrc_record_v4(uuid, text, uuid, jsonb, text, text) to authenticated;

create or replace function public.capture_xrc_domain_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  row_id text;
  actor_id uuid;
  subject_id uuid;
  event_type text;
  stream_type text;
  event_data jsonb := '{}'::jsonb;
  changed_fields text[] := array[]::text[];
  watched_fields text[];
  content_type text;
  field_name text;
  before_state jsonb;
  after_state jsonb;
  before_ref text;
  after_ref text;
  source_operation text;
  idempotency_key text;
begin
  row_id := coalesce(new_row->>'id', old_row->>'id');
  if row_id is null then
    row_id := coalesce(new_row->>'record_id', old_row->>'record_id');
  end if;

  if tg_table_name = 'profiles' then
    stream_type := 'XARC';
    subject_id := coalesce(nullif(new_row->>'id', '')::uuid, nullif(old_row->>'id', '')::uuid);
    actor_id := auth.uid();
    watched_fields := array[
      'full_name', 'username', 'bio', 'avatar_id', 'banner_image_id', 'profile_tags',
      'is_private', 'show_email', 'show_phone', 'account_status', 'account_activated',
      'subscription_tier', 'subscription_expires', 'is_pro', 'verified', 'require_2fa',
      'security_level', 'phone_verified', 'facial_verification_enabled',
      'fingerprint_enabled', 'preferences', 'password_changed_at'
    ];
    if tg_op = 'INSERT' then
      event_type := 'account_created';
      after_state := new_row;
      changed_fields := watched_fields;
    elsif tg_op = 'DELETE' then
      event_type := 'account_deleted';
      before_state := old_row;
      changed_fields := watched_fields;
    else
      foreach field_name in array watched_fields loop
        if old_row->field_name is distinct from new_row->field_name then
          changed_fields := array_append(changed_fields, field_name);
        end if;
      end loop;
      if cardinality(changed_fields) = 0 then return new; end if;
      event_type := case
        when changed_fields && array[
          'account_status', 'account_activated', 'is_pro', 'verified', 'require_2fa',
          'security_level', 'phone_verified', 'facial_verification_enabled',
          'fingerprint_enabled', 'password_changed_at'
        ] then 'account_security_changed'
        when changed_fields && array['is_private', 'show_email', 'show_phone', 'preferences']
          then 'account_visibility_changed'
        when changed_fields && array['subscription_tier', 'subscription_expires']
          then 'account_subscription_changed'
        else 'profile_updated'
      end;
    end if;
    if tg_op <> 'INSERT' then
      select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
        into before_state
        from jsonb_each(old_row) as entry
        where entry.key = any(watched_fields);
    end if;
    if tg_op <> 'DELETE' then
      select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
        into after_state
        from jsonb_each(new_row) as entry
        where entry.key = any(watched_fields);
    end if;
    event_data := jsonb_build_object('changed_fields', changed_fields);

  elsif tg_table_name in ('posts', 'reels', 'stories') then
    stream_type := 'XCRC';
    content_type := case tg_table_name when 'posts' then 'post' when 'reels' then 'reel' else 'story' end;
    subject_id := coalesce(nullif(new_row->>'user_id', '')::uuid, nullif(old_row->>'user_id', '')::uuid);
    actor_id := auth.uid();
    watched_fields := case tg_table_name
      when 'posts' then array['content', 'image_ids', 'image_metadata', 'video_ids', 'video_metadata', 'category', 'audience', 'is_text_card', 'text_card_metadata', 'card_caption', 'deleted_at']
      when 'reels' then array['video_id', 'video_metadata', 'thumbnail_id', 'caption', 'music', 'category', 'duration', 'deleted_at']
      else array['title', 'preview', 'full_content', 'cover_image_id', 'cover_image_metadata', 'category', 'unlock_cost', 'deleted_at']
    end;
    if tg_op = 'INSERT' then
      event_type := content_type || '_created';
      after_state := new_row;
      changed_fields := watched_fields;
    elsif tg_op = 'DELETE' then
      event_type := content_type || '_deleted';
      before_state := old_row;
      changed_fields := watched_fields;
    else
      foreach field_name in array watched_fields loop
        if old_row->field_name is distinct from new_row->field_name then
          changed_fields := array_append(changed_fields, field_name);
        end if;
      end loop;
      if cardinality(changed_fields) = 0 then return new; end if;
      if old_row->>'deleted_at' is distinct from new_row->>'deleted_at' then
        event_type := case when new_row->>'deleted_at' is null then content_type || '_restored' else content_type || '_deleted' end;
      else
        event_type := content_type || '_edited';
      end if;
      before_state := old_row;
      after_state := new_row;
    end if;
    if tg_op <> 'INSERT' then
      select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
        into before_state
        from jsonb_each(old_row) as entry
        where entry.key = any(watched_fields);
    end if;
    if tg_op <> 'DELETE' then
      select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
        into after_state
        from jsonb_each(new_row) as entry
        where entry.key = any(watched_fields);
    end if;
    before_ref := case when before_state is null then null else encode(extensions.digest(convert_to(public.xrc_canonical_jsonb(before_state), 'UTF8'), 'sha256'), 'hex') end;
    after_ref := case when after_state is null then null else encode(extensions.digest(convert_to(public.xrc_canonical_jsonb(after_state), 'UTF8'), 'sha256'), 'hex') end;
    event_data := jsonb_build_object(
      'content_type', content_type,
      'content_id', row_id,
      'changed_fields', changed_fields,
      'before_version_ref', before_ref,
      'after_version_ref', after_ref
    );

  elsif tg_table_name = 'ep_transactions' then
    stream_type := 'XWRC';
    subject_id := nullif(new_row->>'user_id', '')::uuid;
    actor_id := auth.uid();
    event_type := case new_row->>'type'
      when 'purchase_grant' then 'ep_purchased'
      when 'spend' then 'ep_spent'
      when 'refund' then 'ep_refunded'
      when 'expiry' then 'ep_expired'
      else 'ep_credited'
    end;
    event_data := jsonb_build_object(
      'ledger_entry_id', new_row->>'id',
      'amount', (new_row->>'amount')::numeric,
      'currency', 'EP',
      'transaction_type', new_row->>'type',
      'balance_before', (new_row->>'balance_after')::numeric - (new_row->>'amount')::numeric,
      'balance_after', (new_row->>'balance_after')::numeric,
      'reference_payment_id', new_row->>'ref_payment_id',
      'reference_product_id', new_row->>'ref_product_id'
    );

  elsif tg_table_name = 'wallet_history' then
    stream_type := 'XWRC';
    subject_id := nullif(new_row->>'user_id', '')::uuid;
    actor_id := auth.uid();
    event_type := case new_row->>'change_type' when 'credit' then 'wallet_credited' else 'wallet_debited' end;
    event_data := jsonb_build_object(
      'ledger_entry_id', new_row->>'id',
      'transaction_reference', new_row->>'transaction_id',
      'amount', (new_row->>'amount')::numeric,
      'currency', coalesce(new_row->'metadata'->>'currency', new_row->'metadata'->>'currency_type', 'XEV'),
      'balance_before', (new_row->>'balance_before')::numeric,
      'balance_after', (new_row->>'balance_after')::numeric,
      'change_type', new_row->>'change_type'
    );

  elsif tg_table_name = 'transactions' then
    stream_type := 'XTRC';
    subject_id := coalesce(nullif(new_row->>'to_user_id', '')::uuid, nullif(new_row->>'from_user_id', '')::uuid);
    actor_id := auth.uid();
    if tg_op = 'INSERT' then
      event_type := 'transaction_created';
    elsif old_row->>'status' is distinct from new_row->>'status' then
      event_type := case new_row->>'status'
        when 'completed' then 'transaction_settled'
        when 'refunded' then 'transaction_refunded'
        when 'failed' then 'transaction_failed'
        when 'cancelled' then 'transaction_cancelled'
        else 'transaction_status_changed'
      end;
    else
      return new;
    end if;
    event_data := jsonb_build_object(
      'transaction_reference', new_row->>'id',
      'transaction_type', new_row->>'type',
      'status', new_row->>'status',
      'amount', (new_row->>'amount')::numeric,
      'currency', coalesce(new_row->'metadata'->>'currency', new_row->'metadata'->>'currency_type', 'XEV'),
      'from_user_id', new_row->>'from_user_id',
      'to_user_id', new_row->>'to_user_id',
      'subject_ids', jsonb_strip_nulls(jsonb_build_array(new_row->>'from_user_id', new_row->>'to_user_id'))
    );

  elsif tg_table_name = 'profile_boosts' then
    stream_type := 'XARC';
    subject_id := nullif(new_row->>'user_id', '')::uuid;
    actor_id := auth.uid();
    if tg_op = 'INSERT' then
      event_type := 'upgrade_started';
    elsif old_row->>'status' is distinct from new_row->>'status' then
      event_type := case new_row->>'status'
        when 'cancelled' then 'upgrade_cancelled'
        when 'expired' then 'upgrade_expired'
        else 'upgrade_status_changed'
      end;
    elsif old_row->>'boost_tier' is distinct from new_row->>'boost_tier'
       or old_row->>'billing' is distinct from new_row->>'billing'
       or old_row->>'auto_renew' is distinct from new_row->>'auto_renew'
       or old_row->>'expires_at' is distinct from new_row->>'expires_at' then
      event_type := 'upgrade_changed';
    else
      return new;
    end if;
    event_data := jsonb_build_object(
      'upgrade_reference', new_row->>'id',
      'tier', new_row->>'boost_tier',
      'billing_period', new_row->>'billing',
      'status', new_row->>'status',
      'ep_cost', nullif(new_row->>'ep_cost', '')::numeric,
      'starts_at', new_row->>'starts_at',
      'expires_at', new_row->>'expires_at',
      'auto_renew', (new_row->>'auto_renew')::boolean,
      'payment_reference', new_row->>'payment_id'
    );

  elsif tg_table_name = 'ad_campaigns' then
    stream_type := 'XTRC';
    subject_id := nullif(new_row->>'owner_id', '')::uuid;
    actor_id := auth.uid();
    if tg_op = 'INSERT' then
      event_type := 'ad_campaign_created';
    elsif old_row->>'status' is distinct from new_row->>'status' then
      event_type := 'ad_campaign_status_changed';
    elsif old_row->>'budget_ep' is distinct from new_row->>'budget_ep'
       or old_row->>'escrow_ep' is distinct from new_row->>'escrow_ep' then
      event_type := 'ad_campaign_budget_changed';
    else
      return new;
    end if;
    event_data := jsonb_build_object(
      'campaign_reference', new_row->>'id',
      'objective', new_row->>'objective',
      'status', new_row->>'status',
      'budget_ep', nullif(new_row->>'budget_ep', '')::numeric,
      'escrow_ep', nullif(new_row->>'escrow_ep', '')::numeric,
      'starts_at', new_row->>'starts_at',
      'ends_at', new_row->>'ends_at'
    );
  else
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  source_operation := tg_table_name || '.' || lower(tg_op);
  idempotency_key := 'db:' || tg_table_name || ':' || coalesce(row_id, 'unknown') || ':' ||
      coalesce(event_type, 'event') || ':' || txid_current()::text || ':' || gen_random_uuid()::text;

  perform public.xrc_append_event_v4_internal(
    gen_random_uuid(),
    stream_type,
    actor_id,
    jsonb_build_object(
      'event', event_type,
      'entity_type', tg_table_name,
      'entity_id', row_id,
      'subject_id', subject_id
    ) || event_data,
    idempotency_key,
    source_operation,
    1::smallint
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.capture_xrc_domain_event() from public, anon, authenticated;
revoke all on function public.append_xrc_record(
  uuid, text, text, text, uuid, jsonb, bigint, smallint, timestamptz, text
) from public, anon, authenticated;

drop policy if exists "XRC actors can read own events" on public.xrc_records;
create policy "XRC actors can read own events" on public.xrc_records
  for select to authenticated
  using (
    actor_id = auth.uid()
    or payload->>'subject_id' = auth.uid()::text
    or payload->'subject_ids' ? auth.uid()::text
  );

drop trigger if exists xrc_capture_profiles on public.profiles;
create trigger xrc_capture_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.capture_xrc_domain_event();

drop trigger if exists xrc_capture_ep_transactions on public.ep_transactions;
create trigger xrc_capture_ep_transactions
  after insert on public.ep_transactions
  for each row execute function public.capture_xrc_domain_event();

drop trigger if exists xrc_capture_wallet_history on public.wallet_history;
create trigger xrc_capture_wallet_history
  after insert on public.wallet_history
  for each row execute function public.capture_xrc_domain_event();

drop trigger if exists xrc_capture_transactions on public.transactions;
create trigger xrc_capture_transactions
  after insert or update on public.transactions
  for each row execute function public.capture_xrc_domain_event();

drop trigger if exists xrc_capture_profile_boosts on public.profile_boosts;
create trigger xrc_capture_profile_boosts
  after insert or update on public.profile_boosts
  for each row execute function public.capture_xrc_domain_event();

drop trigger if exists xrc_capture_ad_campaigns on public.ad_campaigns;
create trigger xrc_capture_ad_campaigns
  after insert or update on public.ad_campaigns
  for each row execute function public.capture_xrc_domain_event();

drop trigger if exists xrc_capture_posts on public.posts;
create trigger xrc_capture_posts
  after insert or update or delete on public.posts
  for each row execute function public.capture_xrc_domain_event();

drop trigger if exists xrc_capture_reels on public.reels;
create trigger xrc_capture_reels
  after insert or update or delete on public.reels
  for each row execute function public.capture_xrc_domain_event();

drop trigger if exists xrc_capture_stories on public.stories;
create trigger xrc_capture_stories
  after insert or update or delete on public.stories
  for each row execute function public.capture_xrc_domain_event();

create index if not exists xrc_records_event_lookup_idx
  on public.xrc_records(actor_id, stream_type, timestamp desc);

comment on table public.xrc_records is
  'Append-only XRC records. Version 4 events are atomically captured from business-row transactions; hashes commit to the canonical record envelope, not to the truth of its claims.';
