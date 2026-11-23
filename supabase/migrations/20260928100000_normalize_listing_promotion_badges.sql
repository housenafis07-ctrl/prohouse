begin;

-- Normalize public promotion badges. The UI renders the badge that was
-- actually activated on the listing; Premium is presented as VIP.
update public.monetization_products
set
  name = case when code = 'premium' then 'VIP' else name end,
  name_ru = case when code = 'premium' then 'VIP' else name_ru end,
  badge = case
    when code = 'premium' then 'VIP'
    when code = 'highlight' then 'HIGHLIGHT'
    when code in ('top_1','top_3','top_7','top_14','top_30') then 'TOP'
    when code = 'up' then 'UP'
    else badge
  end,
  badge_ru = case
    when code = 'premium' then 'VIP'
    when code = 'highlight' then 'HIGHLIGHT'
    when code in ('top_1','top_3','top_7','top_14','top_30') then 'TOP'
    when code = 'up' then 'UP'
    else badge_ru
  end,
  updated_at = now()
where code in ('premium','highlight','top_1','top_3','top_7','top_14','top_30','up');

commit;
