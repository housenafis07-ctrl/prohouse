begin;

-- Extra listing credits are one-time entitlements, not day-based promotions.
-- Keep the legacy product code consumed by listing quota logic and ensure neither
-- the single-credit tariff nor the 5-pack expires after the generic activation RPC.
create or replace function public.normalize_extra_listing_entitlement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.product_code = 'extra_listing' then
    new.quantity_total := 1;
    new.quantity_remaining := 1;
    new.ends_at := null;
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'purchased_product_code', 'extra_listing',
        'one_time_pack_size', 1
      );
  elsif new.product_code = 'extra_listing_5' then
    new.product_code := 'extra_listing';
    new.quantity_total := 5;
    new.quantity_remaining := 5;
    new.ends_at := null;
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'purchased_product_code', 'extra_listing_5',
        'one_time_pack_size', 5
      );
  end if;
  return new;
end;
$$;

commit;
