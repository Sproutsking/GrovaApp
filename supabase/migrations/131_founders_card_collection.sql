create table if not exists public.founders_card_tiers (
  tier text primary key check (tier in ('Silver', 'Gold', 'Diamond', 'VIP')),
  supply integer not null check (supply > 0),
  list_price numeric(12, 2) not null check (list_price > 0),
  price_currency text check (price_currency in ('USD')),
  max_per_user integer not null default 1 check (max_per_user between 1 and 50),
  sale_enabled boolean not null default false,
  transfers_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.founders_card_tiers (tier, supply, list_price, price_currency)
values
  ('Silver', 900, 12, null),
  ('Gold', 300, 25, null),
  ('Diamond', 150, 50, null),
  ('VIP', 50, 100, null)
on conflict (tier) do nothing;

create table if not exists public.founders_card_policy (
  singleton boolean primary key default true check (singleton),
  reservation_hours integer not null default 24 check (reservation_hours between 1 and 168),
  late_paystack_action text not null default 'auto_refund'
    check (late_paystack_action in ('auto_refund', 'manual_review')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.founders_card_policy (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.founders_card_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  tier text not null references public.founders_card_tiers(tier),
  quantity integer not null check (quantity between 1 and 50),
  unit_price numeric(12, 2) not null check (unit_price > 0),
  total_price numeric(12, 2) not null check (total_price = unit_price * quantity),
  currency text not null check (currency = 'USD'),
  provider text not null check (provider in ('paystack', 'web3')),
  idempotency_key uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'cancelled')),
  provider_reference text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists founders_card_orders_user_status_idx
  on public.founders_card_orders (user_id, status, created_at desc);
create index if not exists founders_card_orders_expiry_idx
  on public.founders_card_orders (expires_at)
  where status = 'pending';

create table if not exists public.founders_cards (
  id uuid primary key default gen_random_uuid(),
  tier text not null references public.founders_card_tiers(tier),
  serial integer not null check (serial > 0),
  supply integer not null check (supply > 0),
  serial_display text not null,
  card_code text not null unique,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'owned')),
  owner_id uuid references public.profiles(id),
  reserved_order_id uuid references public.founders_card_orders(id),
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tier, serial),
  check (
    (status = 'available' and owner_id is null and reserved_order_id is null)
    or (status = 'reserved' and owner_id is null and reserved_order_id is not null)
    or (status = 'owned' and owner_id is not null and reserved_order_id is null and issued_at is not null)
  )
);

create index if not exists founders_cards_owner_tier_idx
  on public.founders_cards (owner_id, tier, serial);
create index if not exists founders_cards_sale_order_idx
  on public.founders_cards (tier, status, serial);

create table if not exists public.founders_card_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.founders_card_orders(id),
  provider text not null check (provider in ('paystack', 'web3')),
  provider_reference text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('NGN', 'USD')),
  status text not null default 'pending'
    check (status in ('initializing', 'pending', 'completed', 'failed', 'late_crypto_review', 'refund_required', 'refund_pending', 'refunded')),
  checkout_url text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (provider, provider_reference),
  unique (order_id, provider)
);

create table if not exists public.founders_card_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.founders_cards(id),
  event_type text not null check (event_type in ('issued', 'transferred')),
  from_user_id uuid references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  order_id uuid references public.founders_card_orders(id),
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists founders_card_events_card_created_idx
  on public.founders_card_events (card_id, created_at desc);

create or replace function public.founders_card_code_valid(p_code text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  body text;
  checksum integer := 0;
  character_index integer;
  position_index integer;
begin
  if p_code is null or p_code !~ '^[A-Z0-9]{5}-[A-Z0-9]{5}$' then
    return false;
  end if;
  body := replace(p_code, '-', '');
  for position_index in 1..9 loop
    character_index := strpos(alphabet, substr(body, position_index, 1)) - 1;
    if character_index < 0 then return false; end if;
    checksum := checksum + position_index * character_index;
  end loop;
  return substr(body, 10, 1) = substr(alphabet, (checksum % length(alphabet)) + 1, 1);
end;
$$;

alter function public.founders_card_code_valid(text) owner to postgres;
revoke all on function public.founders_card_code_valid(text) from public, anon, authenticated;

alter table public.founders_card_tiers enable row level security;
alter table public.founders_card_policy enable row level security;
alter table public.founders_card_orders enable row level security;
alter table public.founders_cards enable row level security;
alter table public.founders_card_payments enable row level security;
alter table public.founders_card_events enable row level security;

revoke all on public.founders_card_tiers, public.founders_card_policy, public.founders_card_orders,
  public.founders_cards, public.founders_card_payments, public.founders_card_events
  from anon, authenticated;

create or replace function public.founders_card_is_ceo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_team
    where user_id = auth.uid()
      and role = 'ceo_owner'
      and status = 'active'
  );
$$;

alter function public.founders_card_is_ceo() owner to postgres;
revoke all on function public.founders_card_is_ceo() from public, anon, authenticated;
grant execute on function public.founders_card_is_ceo() to authenticated, service_role;

create or replace function public.admin_import_founders_cards(p_cards jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  imported_count integer;
begin
  if not public.founders_card_is_ceo() then
    raise exception 'Only the CEO can import the founders-card registry';
  end if;
  if jsonb_typeof(p_cards) is distinct from 'array' then
    raise exception 'The registry must be a JSON array';
  end if;
  if jsonb_array_length(p_cards) <> 1400 then
    raise exception 'The registry must contain exactly 1,400 cards';
  end if;
  if exists (select 1 from public.founders_cards)
    or exists (select 1 from public.founders_card_orders) then
    raise exception 'The registry can only be imported once, before sales begin';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_cards) as r(
      tier text, serial integer, supply integer, serial_display text,
      card_code text, list_price numeric, status text, owner_id text, issued_at text
    )
    left join public.founders_card_tiers t on t.tier = r.tier
    where t.tier is null
      or r.serial is null
      or r.supply is distinct from t.supply
      or r.list_price is distinct from t.list_price
      or r.serial_display is null
      or r.serial_display <> '#' || lpad(r.serial::text, 6, '0') || '/' || lpad(t.supply::text, 4, '0')
      or r.card_code is null
      or not public.founders_card_code_valid(r.card_code)
      or r.status is distinct from 'available'
      or nullif(trim(r.owner_id), '') is not null
      or nullif(trim(r.issued_at), '') is not null
  ) then
    raise exception 'Registry values do not match the fixed tier supply, serial, price, or unissued status';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_cards) as r(
      tier text, serial integer, supply integer, serial_display text,
      card_code text, list_price numeric, status text, owner_id text, issued_at text
    )
    group by r.card_code having count(*) > 1
  ) or exists (
    select 1 from jsonb_to_recordset(p_cards) as r(
      tier text, serial integer, supply integer, serial_display text,
      card_code text, list_price numeric, status text, owner_id text, issued_at text
    )
    group by r.tier, r.serial having count(*) > 1
  ) then
    raise exception 'Registry contains duplicate card codes or serials';
  end if;

  if exists (
    select 1
    from public.founders_card_tiers t
    left join (
      select r.tier, count(*) as row_count, min(r.serial) as min_serial, max(r.serial) as max_serial
      from jsonb_to_recordset(p_cards) as r(
        tier text, serial integer, supply integer, serial_display text,
        card_code text, list_price numeric, status text, owner_id text, issued_at text
      )
      group by r.tier
    ) supplied on supplied.tier = t.tier
    where coalesce(supplied.row_count, 0) <> t.supply
      or coalesce(supplied.min_serial, 0) <> 1
      or coalesce(supplied.max_serial, 0) <> t.supply
  ) then
    raise exception 'Registry does not contain every serial number for each tier';
  end if;

  insert into public.founders_cards (tier, serial, supply, serial_display, card_code)
  select r.tier, r.serial, r.supply, r.serial_display, r.card_code
  from jsonb_to_recordset(p_cards) as r(
    tier text, serial integer, supply integer, serial_display text,
    card_code text, list_price numeric, status text, owner_id text, issued_at text
  );

  get diagnostics imported_count = row_count;
  return imported_count;
end;
$$;

alter function public.admin_import_founders_cards(jsonb) owner to postgres;
revoke all on function public.admin_import_founders_cards(jsonb) from public, anon;
grant execute on function public.admin_import_founders_cards(jsonb) to authenticated;

create or replace function public.admin_get_founders_card_config()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.founders_card_is_ceo() then
    raise exception 'Only the CEO can view founders-card controls';
  end if;
  perform public.expire_founders_card_orders();

  select jsonb_build_object(
    'registry_count', (select count(*) from public.founders_cards),
    'policy', (
      select jsonb_build_object(
        'reservation_hours', reservation_hours,
        'late_paystack_action', late_paystack_action,
        'updated_at', updated_at
      )
      from public.founders_card_policy
      where singleton
    ),
    'late_payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_id', p.order_id,
        'user_id', o.user_id,
        'tier', o.tier,
        'provider', p.provider,
        'provider_reference', p.provider_reference,
        'amount_minor', p.amount_minor,
        'currency', p.currency,
        'status', p.status,
        'failure_reason', p.failure_reason,
        'created_at', p.created_at
      ) order by p.created_at desc)
      from (
        select *
        from public.founders_card_payments
        where status in ('late_crypto_review', 'refund_required', 'refund_pending')
        order by created_at desc
        limit 50
      ) p
      join public.founders_card_orders o on o.id = p.order_id
    ), '[]'::jsonb),
    'tiers', coalesce(jsonb_agg(jsonb_build_object(
      'tier', t.tier,
      'supply', t.supply,
      'list_price', t.list_price,
      'price_currency', t.price_currency,
      'max_per_user', t.max_per_user,
      'sale_enabled', t.sale_enabled,
      'transfers_enabled', t.transfers_enabled,
      'available', (select count(*) from public.founders_cards c where c.tier = t.tier and c.status = 'available'),
      'reserved', (select count(*) from public.founders_cards c where c.tier = t.tier and c.status = 'reserved'),
      'owned', (select count(*) from public.founders_cards c where c.tier = t.tier and c.status = 'owned')
    ) order by case t.tier when 'Silver' then 1 when 'Gold' then 2 when 'Diamond' then 3 else 4 end), '[]'::jsonb)
  ) into result
  from public.founders_card_tiers t;

  return result;
end;
$$;

alter function public.admin_get_founders_card_config() owner to postgres;
revoke all on function public.admin_get_founders_card_config() from public, anon;
grant execute on function public.admin_get_founders_card_config() to authenticated;

create or replace function public.admin_update_founders_card_policy(
  p_reservation_hours integer,
  p_late_paystack_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.founders_card_is_ceo() then
    raise exception 'Only the CEO can update founders-card policy';
  end if;
  if p_reservation_hours is null or p_reservation_hours not between 1 and 168
    or p_late_paystack_action is null
    or p_late_paystack_action not in ('auto_refund', 'manual_review') then
    raise exception 'Invalid founders-card reservation policy';
  end if;

  update public.founders_card_policy
  set reservation_hours = p_reservation_hours,
      late_paystack_action = p_late_paystack_action,
      updated_at = now(),
      updated_by = auth.uid()
  where singleton;
end;
$$;

alter function public.admin_update_founders_card_policy(integer, text) owner to postgres;
revoke all on function public.admin_update_founders_card_policy(integer, text) from public, anon;
grant execute on function public.admin_update_founders_card_policy(integer, text) to authenticated;

create or replace function public.admin_update_founders_card_tier(
  p_tier text,
  p_list_price numeric,
  p_currency text,
  p_max_per_user integer,
  p_sale_enabled boolean,
  p_transfers_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_supply integer;
  imported_supply integer;
begin
  if not public.founders_card_is_ceo() then
    raise exception 'Only the CEO can update founders-card settings';
  end if;
  if p_currency is not null and p_currency <> 'USD' then
    raise exception 'Founders-card prices are currently denominated in USD';
  end if;
  if p_list_price is null or p_list_price <= 0
    or p_list_price > 10000000
    or p_max_per_user is null or p_max_per_user not between 1 and 50
    or p_sale_enabled is null or p_transfers_enabled is null then
    raise exception 'Invalid founders-card tier settings';
  end if;

  select supply into expected_supply
  from public.founders_card_tiers
  where tier = p_tier
  for update;
  if not found then
    raise exception 'Unknown founders-card tier';
  end if;

  select count(*) into imported_supply
  from public.founders_cards
  where tier = p_tier;
  if p_sale_enabled and (p_currency is null or imported_supply <> expected_supply) then
    raise exception 'Import the complete tier registry and confirm USD pricing before enabling sales';
  end if;

  update public.founders_card_tiers
  set list_price = p_list_price,
      price_currency = p_currency,
      max_per_user = p_max_per_user,
      sale_enabled = p_sale_enabled,
      transfers_enabled = p_transfers_enabled,
      updated_at = now(),
      updated_by = auth.uid()
  where tier = p_tier;
end;
$$;

alter function public.admin_update_founders_card_tier(text, numeric, text, integer, boolean, boolean) owner to postgres;
revoke all on function public.admin_update_founders_card_tier(text, numeric, text, integer, boolean, boolean) from public, anon;
grant execute on function public.admin_update_founders_card_tier(text, numeric, text, integer, boolean, boolean) to authenticated;

create or replace function public.expire_founders_card_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.founders_card_orders
  set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at <= now();
  get diagnostics expired_count = row_count;

  update public.founders_cards c
  set status = 'available', reserved_order_id = null
  where c.status = 'reserved'
    and exists (
      select 1 from public.founders_card_orders o
      where o.id = c.reserved_order_id and o.status = 'expired'
    );

  update public.founders_card_payments p
  set status = 'late_crypto_review',
      failure_reason = 'Crypto payment was submitted but not verified before reservation expiry; verify the transaction and refund manually if confirmed.'
  where p.provider = 'web3'
    and p.status = 'pending'
    and exists (
      select 1 from public.founders_card_orders o
      where o.id = p.order_id and o.status = 'expired'
    );

  return expired_count;
end;
$$;

alter function public.expire_founders_card_orders() owner to postgres;
revoke all on function public.expire_founders_card_orders() from public, anon, authenticated;
grant execute on function public.expire_founders_card_orders() to service_role;

create or replace function public.get_founders_card_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.expire_founders_card_orders();
  select jsonb_build_object(
    'tiers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tier', t.tier,
        'supply', t.supply,
        'list_price', t.list_price,
        'price_currency', t.price_currency,
        'max_per_user', t.max_per_user,
        'sale_enabled', t.sale_enabled,
        'transfers_enabled', t.transfers_enabled,
        'available', (select count(*) from public.founders_cards c where c.tier = t.tier and c.status = 'available'),
        'reserved', (select count(*) from public.founders_cards c where c.tier = t.tier and c.status = 'reserved'),
        'owned', (select count(*) from public.founders_cards c where c.tier = t.tier and c.status = 'owned')
      ) order by case t.tier when 'Silver' then 1 when 'Gold' then 2 when 'Diamond' then 3 else 4 end)
      from public.founders_card_tiers t
    ), '[]'::jsonb),
    'cards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tier', c.tier,
        'serial', c.serial,
        'supply', c.supply,
        'serial_display', c.serial_display,
        'status', c.status
      ) order by case c.tier when 'Silver' then 1 when 'Gold' then 2 when 'Diamond' then 3 else 4 end, c.serial)
      from public.founders_cards c
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

alter function public.get_founders_card_catalog() owner to postgres;
revoke all on function public.get_founders_card_catalog() from public, anon;
grant execute on function public.get_founders_card_catalog() to authenticated;

create or replace function public.get_my_founders_cards()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'tier', c.tier,
    'serial', c.serial,
    'supply', c.supply,
    'serial_display', c.serial_display,
    'card_code', c.card_code,
    'issued_at', c.issued_at,
    'transfers_enabled', t.transfers_enabled
  ) order by case c.tier when 'Silver' then 1 when 'Gold' then 2 when 'Diamond' then 3 else 4 end, c.serial), '[]'::jsonb)
  from public.founders_cards c
  join public.founders_card_tiers t on t.tier = c.tier
  where c.owner_id = auth.uid() and c.status = 'owned';
$$;

alter function public.get_my_founders_cards() owner to postgres;
revoke all on function public.get_my_founders_cards() from public, anon;
grant execute on function public.get_my_founders_cards() to authenticated;

create or replace function public.reserve_founders_card_purchase(
  p_tier text,
  p_quantity integer,
  p_provider text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer_id uuid := auth.uid();
  tier_config public.founders_card_tiers;
  existing_order public.founders_card_orders;
  selected_ids uuid[];
  order_row public.founders_card_orders;
  owned_count integer;
  reserved_count integer;
  reservation_hours integer;
begin
  if buyer_id is null then
    raise exception 'Sign in to purchase a founders card';
  end if;
  if p_quantity is null or p_quantity < 1 or p_provider is null
    or p_provider not in ('paystack', 'web3')
    or p_idempotency_key is null then
    raise exception 'Invalid founders-card purchase request';
  end if;
  perform public.expire_founders_card_orders();
  select policy.reservation_hours into reservation_hours
  from public.founders_card_policy policy
  where policy.singleton
  for share;
  if reservation_hours is null then
    raise exception 'Founders-card reservation policy is not configured';
  end if;

  select * into existing_order
  from public.founders_card_orders
  where user_id = buyer_id and idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing_order.tier <> p_tier or existing_order.quantity <> p_quantity
      or existing_order.provider <> p_provider then
      raise exception 'This purchase key is already associated with a different order';
    end if;
    return jsonb_build_object(
      'order_id', existing_order.id,
      'tier', existing_order.tier,
      'quantity', existing_order.quantity,
      'unit_price', existing_order.unit_price,
      'total_price', existing_order.total_price,
      'currency', existing_order.currency,
      'status', existing_order.status,
      'expires_at', existing_order.expires_at
    );
  end if;

  select * into tier_config
  from public.founders_card_tiers
  where tier = p_tier
  for update;
  if not found then
    raise exception 'Unknown founders-card tier';
  end if;
  if not tier_config.sale_enabled or tier_config.price_currency is distinct from 'USD' then
    raise exception 'This founders-card tier is not currently available for purchase';
  end if;
  if p_quantity > tier_config.max_per_user then
    raise exception 'You can purchase up to % card(s) in this tier', tier_config.max_per_user;
  end if;

  select count(*) into owned_count
  from public.founders_cards
  where tier = p_tier and owner_id = buyer_id and status = 'owned';
  select coalesce(sum(quantity), 0)::integer into reserved_count
  from public.founders_card_orders
  where tier = p_tier and user_id = buyer_id and status = 'pending';
  if owned_count + reserved_count + p_quantity > tier_config.max_per_user then
    raise exception 'This purchase would exceed your limit of % card(s) in this tier', tier_config.max_per_user;
  end if;

  select array_agg(id) into selected_ids
  from (
    select id
    from public.founders_cards
    where tier = p_tier and status = 'available'
    order by serial
    limit p_quantity
    for update skip locked
  ) available_cards;
  if coalesce(cardinality(selected_ids), 0) <> p_quantity then
    raise exception 'Not enough cards remain in this tier';
  end if;

  insert into public.founders_card_orders (
    user_id, tier, quantity, unit_price, total_price, currency, provider, idempotency_key, expires_at
  ) values (
    buyer_id, p_tier, p_quantity, tier_config.list_price,
    tier_config.list_price * p_quantity, 'USD', p_provider, p_idempotency_key,
    now() + make_interval(hours => reservation_hours)
  ) returning * into order_row;

  update public.founders_cards
  set status = 'reserved', reserved_order_id = order_row.id
  where id = any(selected_ids);

  return jsonb_build_object(
    'order_id', order_row.id,
    'tier', order_row.tier,
    'quantity', order_row.quantity,
    'unit_price', order_row.unit_price,
    'total_price', order_row.total_price,
    'currency', order_row.currency,
    'status', order_row.status,
    'expires_at', order_row.expires_at
  );
end;
$$;

alter function public.reserve_founders_card_purchase(text, integer, text, uuid) owner to postgres;
revoke all on function public.reserve_founders_card_purchase(text, integer, text, uuid) from public, anon;
grant execute on function public.reserve_founders_card_purchase(text, integer, text, uuid) to authenticated;

create or replace function public.get_founders_card_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.founders_card_orders;
begin
  perform public.expire_founders_card_orders();
  select * into order_row
  from public.founders_card_orders
  where id = p_order_id and user_id = auth.uid();
  if not found then
    raise exception 'Founders-card order not found';
  end if;

  return jsonb_build_object(
    'order_id', order_row.id,
    'tier', order_row.tier,
    'quantity', order_row.quantity,
    'unit_price', order_row.unit_price,
    'total_price', order_row.total_price,
    'currency', order_row.currency,
    'provider', order_row.provider,
    'status', order_row.status,
    'expires_at', order_row.expires_at
  );
end;
$$;

alter function public.get_founders_card_order(uuid) owner to postgres;
revoke all on function public.get_founders_card_order(uuid) from public, anon;
grant execute on function public.get_founders_card_order(uuid) to authenticated;

create or replace function public.settle_founders_card_order(
  p_order_id uuid,
  p_provider text,
  p_provider_reference text,
  p_amount_minor bigint,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.founders_card_orders;
  payment_row public.founders_card_payments;
  issued_ids uuid[];
  updated_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only verified payment services may settle founders-card orders';
  end if;
  select * into order_row
  from public.founders_card_orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Founders-card order not found';
  end if;
  if order_row.status = 'paid' then
    return;
  end if;
  if order_row.status <> 'pending' or order_row.provider <> p_provider
    or order_row.expires_at <= now() then
    raise exception 'Founders-card order is not awaiting this payment provider';
  end if;

  select * into payment_row
  from public.founders_card_payments
  where order_id = order_row.id
    and provider = p_provider
    and provider_reference = p_provider_reference
  for update;
  if not found
    or payment_row.status not in ('initializing', 'pending', 'completed')
    or payment_row.amount_minor <> p_amount_minor
    or payment_row.currency <> p_currency then
    raise exception 'Payment reference, amount, or currency does not match the reserved order';
  end if;
  if (p_provider = 'paystack' and p_currency <> 'NGN')
    or (p_provider = 'web3' and p_currency <> 'USD')
    or (p_provider = 'web3' and p_amount_minor <> round(order_row.total_price * 100)::bigint) then
    raise exception 'Payment denomination does not match the founders-card order';
  end if;

  select array_agg(id) into issued_ids
  from public.founders_cards
  where reserved_order_id = order_row.id and status = 'reserved';
  if coalesce(cardinality(issued_ids), 0) <> order_row.quantity then
    raise exception 'The reserved card allocation is incomplete; order was not settled';
  end if;

  update public.founders_cards
  set status = 'owned',
      owner_id = order_row.user_id,
      reserved_order_id = null,
      issued_at = now()
  where reserved_order_id = order_row.id and status = 'reserved';
  get diagnostics updated_count = row_count;
  if updated_count <> order_row.quantity then
    raise exception 'The reserved card allocation is incomplete; order was not settled';
  end if;

  update public.founders_card_orders
  set status = 'paid',
      provider_reference = p_provider_reference,
      paid_at = now(),
      updated_at = now()
  where id = order_row.id;
  update public.founders_card_payments
  set status = 'completed', completed_at = now()
  where id = payment_row.id;

  insert into public.founders_card_events (card_id, event_type, to_user_id, order_id, actor_id)
  select unnest(issued_ids), 'issued', order_row.user_id, order_row.id, order_row.user_id;
end;
$$;

alter function public.settle_founders_card_order(uuid, text, text, bigint, text) owner to postgres;
revoke all on function public.settle_founders_card_order(uuid, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.settle_founders_card_order(uuid, text, text, bigint, text) to service_role;

create or replace function public.transfer_founders_card(
  p_card_id uuid,
  p_recipient_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  card_row public.founders_cards;
  recipient_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to transfer a founders card';
  end if;
  select id into recipient_id
  from public.profiles
  where lower(username) = lower(trim(p_recipient_username))
    and account_status = 'active'
    and deleted_at is null;
  if recipient_id is null then
    raise exception 'Active recipient not found';
  end if;
  if recipient_id = auth.uid() then
    raise exception 'A card cannot be transferred to its current owner';
  end if;

  select c.* into card_row
  from public.founders_cards c
  join public.founders_card_tiers t on t.tier = c.tier
  where c.id = p_card_id
    and c.owner_id = auth.uid()
    and c.status = 'owned'
    and t.transfers_enabled
  for update of c;
  if not found then
    raise exception 'This card is not owned by you or transfers are disabled for its tier';
  end if;

  update public.founders_cards set owner_id = recipient_id where id = card_row.id;
  insert into public.founders_card_events (
    card_id, event_type, from_user_id, to_user_id, actor_id
  ) values (
    card_row.id, 'transferred', auth.uid(), recipient_id, auth.uid()
  );
end;
$$;

alter function public.transfer_founders_card(uuid, text) owner to postgres;
revoke all on function public.transfer_founders_card(uuid, text) from public, anon;
grant execute on function public.transfer_founders_card(uuid, text) to authenticated;
