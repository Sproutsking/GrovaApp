update public.founders_card_tiers
set price_currency = 'USD',
    updated_at = now()
where price_currency is null
  and sale_enabled = false
  and (
    (tier = 'Silver' and list_price = 12.00)
    or (tier = 'Gold' and list_price = 25.00)
    or (tier = 'Diamond' and list_price = 50.00)
    or (tier = 'VIP' and list_price = 100.00)
  );
