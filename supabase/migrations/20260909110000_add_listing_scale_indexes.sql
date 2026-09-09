-- Listing scale foundation.
-- Keep indexes focused on the public active-listing query path so the database
-- can filter and sort without scanning the full listings table.

create index if not exists listings_active_published_idx
  on public.listings (published_at desc, id desc)
  where status = 'active';

create index if not exists listings_active_type_published_idx
  on public.listings (listing_type, published_at desc, id desc)
  where status = 'active';

create index if not exists listings_active_taxonomy_published_idx
  on public.listings (taxonomy_code, published_at desc, id desc)
  where status = 'active';

create index if not exists listings_active_property_type_published_idx
  on public.listings (property_type, published_at desc, id desc)
  where status = 'active';

create index if not exists listings_active_city_district_published_idx
  on public.listings (city, district, published_at desc, id desc)
  where status = 'active';

create index if not exists listings_active_price_idx
  on public.listings (price, id)
  where status = 'active';

create index if not exists listings_active_mortgage_idx
  on public.listings (is_mortgage_available, published_at desc, id desc)
  where status = 'active' and is_mortgage_available = true;

create index if not exists listings_active_owner_idx
  on public.listings (seller_type, published_at desc, id desc)
  where status = 'active' and seller_type = 'owner';

create index if not exists listings_active_verified_idx
  on public.listings (is_verified, published_at desc, id desc)
  where status = 'active' and is_verified = true;

-- The image table already has a unique (listing_id, sort_order) index. Keep
-- image access ordered and bounded by listing_id instead of loading galleries
-- for the entire result set.
create index if not exists listing_images_listing_sort_idx
  on public.listing_images (listing_id, sort_order, id);
