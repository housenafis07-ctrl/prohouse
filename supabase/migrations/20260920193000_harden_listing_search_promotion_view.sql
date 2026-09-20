begin;

-- Public listing-search projection. Keep sensitive listing fields out of the
-- directly queryable view; the API selects only this public-safe projection.
create or replace view public.listing_search as
select
  id,
  title,
  title_ru,
  listing_type,
  property_type,
  status,
  price,
  currency,
  area_m2,
  rooms,
  floor,
  floors_total,
  district,
  city,
  latitude,
  longitude,
  seller_type,
  seller_name,
  is_mortgage_available,
  is_verified,
  is_featured,
  published_at,
  taxonomy_code,
  promoted_until,
  promotion_rank,
  promotion_badge,
  bumped_at,
  case
    when promoted_until is not null and promoted_until > now()
      then coalesce(promotion_rank, 0)
    when bumped_at is not null and bumped_at > (now() - interval '1 day')
      then greatest(coalesce(promotion_rank, 0), 20)
    else 0
  end as effective_promotion_rank,
  case
    when promoted_until is not null and promoted_until > now()
      then promotion_badge
    when bumped_at is not null and bumped_at > (now() - interval '1 day')
      then 'UP'
    else null
  end as effective_promotion_badge
from public.listings
where status = 'active';

grant select on public.listing_search to anon, authenticated;
revoke insert, update, delete on public.listing_search from anon, authenticated;

commit;
