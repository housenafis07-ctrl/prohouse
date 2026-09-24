begin;

-- Keep the required-attribute check compatible with both the normalized
-- listing_attribute_values table and the draft payload used by the wizard.
create or replace function public.enforce_required_listing_attributes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_missing text;
  v_value jsonb;
begin
  if new.status <> 'moderation' then
    return new;
  end if;

  if nullif(btrim(coalesce(new.title, '')), '') is null then
    raise exception 'LISTING_TITLE_REQUIRED' using errcode = '23514';
  end if;

  if new.price is null or new.price <= 0 then
    raise exception 'LISTING_PRICE_REQUIRED' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(new.city, '')), '') is null
     or nullif(btrim(coalesce(new.district, '')), '') is null then
    raise exception 'LISTING_LOCATION_REQUIRED' using errcode = '23514';
  end if;

  if new.latitude is null or new.longitude is null then
    raise exception 'LISTING_MAP_LOCATION_REQUIRED' using errcode = '23514';
  end if;

  select string_agg(ca.code, ', ' order by ca.sort_order)
    into v_missing
  from public.category_attributes ca
  left join public.listing_attribute_values lav
    on lav.listing_id = new.id
   and lav.attribute_id = ca.id
  where ca.category_code = new.taxonomy_code
    and ca.is_active = true
    and ca.is_required = true
    and (
      (
        lav.id is null
        and ((new.draft_data->'attributes')->ca.code) is null
      )
      or (
        coalesce(lav.value_jsonb, (new.draft_data->'attributes')->ca.code) is null
        or jsonb_typeof(coalesce(lav.value_jsonb, (new.draft_data->'attributes')->ca.code)) = 'null'
        or (
          jsonb_typeof(coalesce(lav.value_jsonb, (new.draft_data->'attributes')->ca.code)) = 'string'
          and nullif(btrim(coalesce(lav.value_jsonb, (new.draft_data->'attributes')->ca.code) #>> '{}'), '') is null
        )
      )
    );

  if v_missing is not null then
    raise exception 'REQUIRED_LISTING_ATTRIBUTES_MISSING:%', v_missing using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.listing_images li where li.listing_id = new.id
  ) then
    raise exception 'LISTING_IMAGE_REQUIRED' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_required_listing_attributes on public.listings;
create constraint trigger trg_enforce_required_listing_attributes
after insert or update of status on public.listings
deferrable initially deferred
for each row
execute function public.enforce_required_listing_attributes();

-- Dacha listings have seasonal weekday/weekend tariffs. The public listing
-- price remains listings.price, so keep it canonical by using the lowest
-- configured base tariff. Extra-guest tariffs are intentionally excluded.
create or replace function public.sync_dacha_listing_price()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_price numeric;
begin
  if new.taxonomy_code = 'rent_dacha' then
    select min((entry.value #>> '{}')::numeric)
      into v_price
    from jsonb_each(coalesce(new.draft_data->'attributes', '{}'::jsonb)) entry
    where entry.key ~ '_(weekday|weekend)_price$'
      and jsonb_typeof(entry.value) in ('number','string')
      and nullif(btrim(entry.value #>> '{}'), '') ~ '^[0-9]+(\\.[0-9]+)?$'
      and (entry.value #>> '{}')::numeric > 0;

    if v_price is not null then
      new.price := v_price;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_dacha_listing_price on public.listings;
create trigger trg_sync_dacha_listing_price
before insert or update of taxonomy_code, draft_data, price on public.listings
for each row
execute function public.sync_dacha_listing_price();

-- The edit wizard uses the RPC directly. Persist the normalized attribute
-- values before changing status to moderation so the deferred validation
-- trigger sees the same data as the draft.
create or replace function public.save_owner_listing(
  p_listing_id uuid,
  p_payload jsonb
)
returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
  v_status text;
  v_owner_value text;
  v_price numeric;
  v_area numeric;
  v_rooms numeric;
  v_floor numeric;
  v_floors_total numeric;
  v_lat numeric;
  v_lng numeric;
  v_attributes jsonb;
  v_attribute jsonb;
  v_raw jsonb;
  v_normalized jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_listing from public.listings where id=p_listing_id and owner_id=auth.uid() for update;
  if not found then raise exception 'LISTING_NOT_FOUND' using errcode='P0002'; end if;
  if v_listing.status not in ('draft','rejected','moderation','active') then raise exception 'LISTING_EDIT_FORBIDDEN_FOR_STATUS' using errcode='42501'; end if;

  v_status := case when v_listing.status='draft' then 'draft' else 'moderation' end;
  v_owner_value := case when coalesce(p_payload->>'ownership_type','')='owner' then 'owner' else null end;
  v_price := nullif(regexp_replace(coalesce(p_payload->>'price',''), '[^0-9.]', '', 'g'), '')::numeric;
  v_area := nullif(p_payload->>'area_m2','')::numeric;
  v_rooms := nullif(p_payload->>'rooms','')::numeric;
  v_floor := nullif(p_payload->>'floor','')::numeric;
  v_floors_total := nullif(p_payload->>'floors_total','')::numeric;
  v_lat := nullif(p_payload->>'latitude','')::numeric;
  v_lng := nullif(p_payload->>'longitude','')::numeric;
  v_attributes := coalesce(p_payload->'draft_data'->'attributes', '{}'::jsonb);

  if coalesce(p_payload->>'taxonomy_code','')='' or coalesce(p_payload->>'title','')='' or v_price is null then
    raise exception 'LISTING_REQUIRED_FIELDS_MISSING' using errcode='22023';
  end if;

  -- Mirror the wizard's attribute payload into the normalized table.
  insert into public.listing_attribute_values(listing_id, attribute_id, value_jsonb, updated_at)
  select
    p_listing_id,
    ca.id,
    coalesce(v_attributes -> ca.code, 'null'::jsonb),
    now()
  from public.category_attributes ca
  where ca.category_code = p_payload->>'taxonomy_code'
    and ca.is_active = true
  on conflict (listing_id, attribute_id)
  do update set value_jsonb=excluded.value_jsonb, updated_at=now();

  update public.listings set
    taxonomy_code=p_payload->>'taxonomy_code',
    title=btrim(p_payload->>'title'),
    description=nullif(btrim(coalesce(p_payload->>'description','')), ''),
    listing_type=coalesce(nullif(p_payload->>'listing_type',''),listing_type),
    property_type=coalesce(nullif(p_payload->>'property_type',''),property_type),
    price=v_price,
    currency=coalesce(nullif(p_payload->>'currency',''),currency),
    area_m2=v_area,
    rooms=v_rooms,
    floor=v_floor,
    floors_total=v_floors_total,
    city=coalesce(nullif(p_payload->>'city',''),city),
    district=nullif(btrim(coalesce(p_payload->>'district','')), ''),
    neighborhood=nullif(btrim(coalesce(p_payload->>'neighborhood','')), ''),
    address=nullif(btrim(coalesce(p_payload->>'address','')), ''),
    latitude=v_lat,
    longitude=v_lng,
    ownership_type=v_owner_value,
    seller_type=v_owner_value,
    is_mortgage_available=coalesce((p_payload->>'is_mortgage_available')::boolean,false),
    draft_data=coalesce(p_payload->'draft_data',draft_data),
    status=v_status
  where id=p_listing_id;

  select * into v_listing from public.listings where id=p_listing_id;
  return v_listing;
end;
$$;

revoke all on function public.save_owner_listing(uuid,jsonb) from public, anon;
grant execute on function public.save_owner_listing(uuid,jsonb) to authenticated;

commit;
