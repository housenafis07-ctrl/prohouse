begin;

-- Keep the public plan catalog exactly aligned with the benefits shown in the
-- partner pricing UI. Payment is intentionally not duplicated here: orders
-- continue through create_monetization_order() and the existing Payme/Click
-- checkout + activation pipeline.
update public.monetization_products
set
  price_uzs = 29000,
  duration_days = 30,
  product_type = 'subscription',
  audience = 'partner',
  unit = 'month',
  quantity = 1,
  active = true,
  metadata = jsonb_build_object(
    'listing_limit', 10,
    'analytics', 'basic',
    'priority_moderation', false,
    'promo_tools', false,
    'priority_support', false,
    'employees', 1,
    'trusted_partner', false
  ),
  updated_at = now()
where code = 'partner_start';

update public.monetization_products
set
  price_uzs = 59000,
  duration_days = 30,
  product_type = 'subscription',
  audience = 'partner',
  unit = 'month',
  quantity = 1,
  active = true,
  metadata = jsonb_build_object(
    'listing_limit', 30,
    'analytics', 'advanced',
    'priority_moderation', true,
    'promo_tools', true,
    'priority_support', false,
    'employees', 1,
    'trusted_partner', false
  ),
  updated_at = now()
where code = 'partner_pro';

update public.monetization_products
set
  price_uzs = 149000,
  duration_days = 30,
  product_type = 'subscription',
  audience = 'partner',
  unit = 'month',
  quantity = 1,
  active = true,
  metadata = jsonb_build_object(
    'listing_limit', 100,
    'listing_limit_label', '100+',
    'analytics', 'advanced',
    'priority_moderation', true,
    'promo_tools', true,
    'priority_support', true,
    'employees', 10,
    'trusted_partner', false,
    'company_profile', true
  ),
  updated_at = now()
where code = 'partner_business';

commit;
