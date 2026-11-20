drop policy if exists founders_card_catalog_authenticated_receive on realtime.messages;
create policy founders_card_catalog_authenticated_receive
  on realtime.messages
  for select
  to authenticated
  using (realtime.topic() = 'founders-card-catalog');

create or replace function public.broadcast_founders_card_catalog_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('tier', new.tier),
    'catalog_updated',
    'founders-card-catalog',
    true
  );
  return new;
end;
$$;

alter function public.broadcast_founders_card_catalog_update() owner to postgres;
revoke all on function public.broadcast_founders_card_catalog_update() from public, anon, authenticated;

drop trigger if exists founders_card_catalog_updated on public.founders_card_tiers;
create trigger founders_card_catalog_updated
  after update of list_price, price_currency, max_per_user, sale_enabled, transfers_enabled
  on public.founders_card_tiers
  for each row
  when (
    old.list_price is distinct from new.list_price
    or old.price_currency is distinct from new.price_currency
    or old.max_per_user is distinct from new.max_per_user
    or old.sale_enabled is distinct from new.sale_enabled
    or old.transfers_enabled is distinct from new.transfers_enabled
  )
  execute function public.broadcast_founders_card_catalog_update();
