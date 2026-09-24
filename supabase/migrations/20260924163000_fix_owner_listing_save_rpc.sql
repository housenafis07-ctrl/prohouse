-- Keep owner listing edits behind a security-definer RPC so protected moderation,
-- publication and billing fields cannot be changed directly by the client.
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
  v_mortgage boolean;
  v_attributes jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_listing
  from public.listings
  where id = p_listing_id
    and owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'LISTING_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_listing.status not in ('draft','rejected','moderation','active') then
    raise exception 'LISTING_EDIT_FORBIDDEN_FOR_STATUS' using errcode = '42501';
  end if;

  v_status := case when v_listing.status = 'draft' then 'draft' else 'moderation' end;
  v_owner_value := case
    when coalesce(p_payload->>'ownership_type', '') = 'owner' then 'owner'
    else null
  end;

  v_price := nullif(
    regexp_replace(coalesce(p_payload->>'price', ''), '[^0-9.]', '', 'g'),
    ''
  )::numeric;
  v_area := nullif(p_payload->>'area_m2', '')::numeric;
  v_rooms := nullif(p_payload->>'rooms', '')::numeric;
  v_floor := nullif(p_payload->>'floor', '')::numeric;
  v_floors_total := nullif(p_payload->>'floors_total', '')::numeric;
  v_lat := nullif(p_payload->>'latitude', '')::numeric;
  v_lng := nullif(p_payload->>'longitude', '')::numeric;
  v_mortgage := case
    when lower(coalesce(p_payload->>'is_mortgage_available', 'false')) = 'true' then true
    else false
  end;
  v_attributes := case
    when jsonb_typeof(p_payload->'draft_data'->'attributes') = 'object'
      then p_payload->'draft_data'->'attributes'
    else '{}'::jsonb
  end;

  if coalesce(p_payload->>'taxonomy_code', '') = ''
     or coalesce(btrim(p_payload->>'title'), '') = ''
     or v_price is null then
    raise exception 'LISTING_REQUIRED_FIELDS_MISSING' using errcode = '22023';
  end if;

  -- The moderation constraint validates category_attributes against
  -- listing_attribute_values. The edit wizard keeps attributes in draft_data,
  -- so synchronize them here before the listing enters moderation.
  insert into public.listing_attribute_values (listing_id, attribute_id, value_jsonb, updated_at)
  select
    p_listing_id,
    ca.id,
    coalesce(v_attributes -> ca.code, 'null'::jsonb),
    now()
  from public.category_attributes ca
  where ca.category_code = p_payload->>'taxonomy_code'
    and ca.is_active = true
  on conflict (listing_id, attribute_id)
  do update set
    value_jsonb = excluded.value_jsonb,
    updated_at = now();

  update public.listings
  set
    taxonomy_code = p_payload->>'taxonomy_code',
    title = btrim(p_payload->>'title'),
    description = nullif(btrim(coalesce(p_payload->>'description', '')), ''),
    listing_type = coalesce(nullif(p_payload->>'listing_type', ''), listing_type),
    property_type = coalesce(nullif(p_payload->>'property_type', ''), property_type),
    price = v_price,
    currency = coalesce(nullif(p_payload->>'currency', ''), currency),
    area_m2 = v_area,
    rooms = v_rooms,
    floor = v_floor,
    floors_total = v_floors_total,
    city = coalesce(nullif(p_payload->>'city', ''), city),
    district = nullif(btrim(coalesce(p_payload->>'district', '')), ''),
    neighborhood = nullif(btrim(coalesce(p_payload->>'neighborhood', '')), ''),
    address = nullif(btrim(coalesce(p_payload->>'address', '')), ''),
    latitude = v_lat,
    longitude = v_lng,
    ownership_type = v_owner_value,
    seller_type = v_owner_value,
    is_mortgage_available = v_mortgage,
    draft_data = coalesce(p_payload->'draft_data', draft_data),
    submitted_at = case when v_status = 'moderation' then now() else submitted_at end,
    status = v_status
  where id = p_listing_id
    and owner_id = auth.uid();

  if not found then
    raise exception 'LISTING_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_listing
  from public.listings
  where id = p_listing_id;

  return v_listing;
end;
$$;

revoke all on function public.save_owner_listing(uuid,jsonb) from public, anon;
grant execute on function public.save_owner_listing(uuid,jsonb) to authenticated;