begin;

-- One-time extra-listing tariffs. Keep the existing single-listing entitlement
-- code stable because listing billing consumes entitlement rows by product_code.
insert into public.monetization_products
  (code, name, name_ru, description, description_ru, price_uzs, duration_days,
   boost_rank, badge, badge_ru, product_type, audience, unit, quantity, active, metadata)
values
  ('extra_listing', 'Qo‘shimcha e’lon', 'Дополнительное объявление',
   '3 ta bepul e’londan keyin yana 1 ta e’lon joylashtirish. Bir martalik to‘lov.',
   'Ещё одно объявление после 3 бесплатных. Разовый платёж.',
   15000, 1, 0, 'Bir martalik', 'Разово', 'extra_listing', 'individual',
   'listing', 1, true, '{"billing":"one_time","entitlement_quantity":1}'::jsonb),
  ('extra_listing_5', '5 ta qo‘shimcha e’lon', 'Пакет из 5 объявлений',
   '3 ta bepul limitdan keyin 5 ta qo‘shimcha e’lon. Bir martalik to‘lov, paket narxi 60 000 so‘m.',
   'Пять дополнительных объявлений после бесплатного лимита. Разовый платёж — 60 000 сум.',
   60000, 1, 0, 'Tejamkor paket', 'Выгодный пакет', 'extra_listing', 'individual',
   'listing', 5, true, '{"billing":"one_time","entitlement_quantity":5}'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  name_ru = excluded.name_ru,
  description = excluded.description,
  description_ru = excluded.description_ru,
  price_uzs = excluded.price_uzs,
  duration_days = excluded.duration_days,
  boost_rank = excluded.boost_rank,
  badge = excluded.badge,
  badge_ru = excluded.badge_ru,
  product_type = excluded.product_type,
  audience = excluded.audience,
  unit = excluded.unit,
  quantity = excluded.quantity,
  active = true,
  metadata = excluded.metadata,
  updated_at = now();

-- The listing quota code intentionally consumes only 'extra_listing'.
-- Convert purchases of the 5-pack into that same entitlement code with five
-- credits; no changes to Payme/Click callbacks or existing promotion products.
create or replace function public.normalize_extra_listing_entitlement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.product_code = 'extra_listing_5' then
    new.product_code := 'extra_listing';
    new.quantity_total := 5;
    new.quantity_remaining := 5;
    new.ends_at := null;
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object('purchased_product_code', 'extra_listing_5', 'one_time_pack_size', 5);
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_extra_listing_entitlement on public.monetization_entitlements;
create trigger normalize_extra_listing_entitlement
before insert on public.monetization_entitlements
for each row execute function public.normalize_extra_listing_entitlement();

commit;
