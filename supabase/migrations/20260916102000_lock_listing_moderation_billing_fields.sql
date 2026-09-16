-- P0 #4: listing owners may edit listing content, but cannot forge
-- moderation, trust, publication, billing or system-controlled fields.

revoke update on table public.listings from public;
revoke update on table public.listings from anon;
revoke update on table public.listings from authenticated;

grant update (
  title, title_ru, description, listing_type, property_type,
  price, currency, area_m2, rooms, floor, floors_total,
  district, neighborhood, city, address, latitude, longitude,
  seller_type, seller_name, seller_phone, is_mortgage_available,
  accommodation_type, max_guests, taxonomy_code, seller_role,
  ownership_type, land_area, primary_image_url, draft_step, draft_data
) on table public.listings to authenticated;

-- Protected fields intentionally receive no direct UPDATE privilege:
-- status, is_verified, is_featured, views_count, published_at,
-- created_at, updated_at, owner_id, listing_code, is_trusted_seller,
-- moderation_note, moderation_updated_at, sold_or_rented_at,
-- billing_status, listing_fee_uzs, is_free_listing, submitted_at.
