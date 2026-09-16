-- P0 #5: harden listing INSERT against client-forged identity,
-- verification/trust, publication and billing values.

revoke all privileges on table public.listings from public;
revoke all privileges on table public.listings from anon;
revoke all privileges on table public.listings from authenticated;

grant select on table public.listings to anon, authenticated;
grant insert (
  owner_id,
  title,
  title_ru,
  description,
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
  neighborhood,
  city,
  address,
  latitude,
  longitude,
  seller_type,
  seller_name,
  seller_phone,
  is_mortgage_available,
  accommodation_type,
  max_guests,
  taxonomy_code,
  seller_role,
  draft_step,
  draft_data,
  ownership_type,
  land_area,
  primary_image_url
) on table public.listings to authenticated;

revoke insert (
  is_verified,
  is_featured,
  published_at,
  created_at,
  updated_at,
  moderation_note,
  moderation_updated_at,
  sold_or_rented_at,
  billing_status,
  listing_fee_uzs,
  is_free_listing,
  submitted_at,
  views_count,
  listing_code,
  is_trusted_seller
) on table public.listings from public, anon, authenticated;

create or replace function public.enforce_listing_insert_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text;
  v_full_name text;
  v_phone text;
  v_company_name text;
  v_is_service boolean;
  v_ownership text;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if new.owner_id is null or new.owner_id <> auth.uid() then
    raise exception 'LISTING_OWNER_MISMATCH' using errcode = '42501';
  end if;

  select p.account_type, p.full_name, p.phone, p.company_name
    into v_account_type, v_full_name, v_phone, v_company_name
  from public.profiles p
  where p.id = auth.uid();

  if not found then
    raise exception 'PROFILE_REQUIRED' using errcode = '42501';
  end if;

  v_is_service := (new.listing_type = 'service' or new.property_type = 'service');
  v_ownership := new.ownership_type;

  if v_is_service then
    new.seller_role := 'service_provider';
    new.seller_type := 'service_provider';
    new.seller_name := coalesce(nullif(trim(v_company_name), ''), nullif(trim(v_full_name), ''));
    new.seller_phone := coalesce(nullif(trim(v_phone), ''), nullif(trim(auth.jwt()->>'phone'), ''));
    new.ownership_type := null;
    new.is_mortgage_available := false;
  elsif v_account_type = 'individual' and v_ownership = 'owner' then
    new.seller_role := 'owner';
    new.seller_type := 'owner';
    new.seller_name := nullif(trim(v_full_name), '');
    new.seller_phone := coalesce(nullif(trim(v_phone), ''), nullif(trim(auth.jwt()->>'phone'), ''));
  elsif v_account_type = 'individual' then
    new.seller_role := null;
    new.seller_type := null;
    new.seller_name := null;
    new.seller_phone := coalesce(nullif(trim(v_phone), ''), nullif(trim(auth.jwt()->>'phone'), ''));
  else
    new.seller_role := null;
    new.seller_type := null;
    new.seller_name := coalesce(nullif(trim(v_company_name), ''), nullif(trim(v_full_name), ''));
    new.seller_phone := coalesce(nullif(trim(v_phone), ''), nullif(trim(auth.jwt()->>'phone'), ''));
  end if;

  if new.status = 'active' then
    new.status := 'moderation';
  end if;
  new.is_verified := false;
  new.is_featured := false;
  new.is_trusted_seller := false;
  new.published_at := null;
  new.moderation_note := null;
  new.moderation_updated_at := null;
  new.sold_or_rented_at := null;
  new.submitted_at := case when new.status = 'moderation' then coalesce(new.submitted_at, now()) else new.submitted_at end;

  return new;
end;
$$;

drop trigger if exists trg_enforce_listing_insert_identity on public.listings;
create trigger trg_enforce_listing_insert_identity
before insert on public.listings
for each row execute function public.enforce_listing_insert_identity();
