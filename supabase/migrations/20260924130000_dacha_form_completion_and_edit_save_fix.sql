-- Royalhouse dacha form completion.
-- Keeps the existing dynamic wizard/taxonomy and adds the missing operational
-- fields shown in the dacha rental flow. Existing codes are preserved where
-- possible so current listings remain compatible.

insert into public.category_attributes
  (category_code, code, name_uz, name_ru, data_type, options, unit, is_required, sort_order, is_active)
values
  ('rent_dacha','single_beds','Bir kishilik yotoqlar soni','Количество односпальных мест','number','[]','ta',false,31,true),
  ('rent_dacha','double_beds','Ikki kishilik yotoqlar soni','Количество двуспальных мест','number','[]','ta',false,32,true),
  ('rent_dacha','weekend_single_customer','Dam olish kunlari bitta mijozga beriladimi?','Предоставляется ли объект одному клиенту на выходные?','select',
    '[{"value":"yes","label_uz":"Ha","label_ru":"Да"},{"value":"no","label_uz":"Yo‘q","label_ru":"Нет"}]',null,false,111,true),
  ('rent_dacha','september_weekday_price','Sentabr oyida ish kunlari uchun narx','Цена за будние дни в сентябре','number','[]','so‘m',false,151,true),
  ('rent_dacha','september_weekend_price','Sentabr oyida dam olish kunlari uchun narx','Цена за выходные дни в сентябре','number','[]','so‘m',false,152,true),
  ('rent_dacha','september_extra_guest_price','Sentabr oyida qo‘shimcha odam uchun narx','Цена за дополнительного гостя в сентябре','number','[]','so‘m',false,153,true),
  ('rent_dacha','october_weekday_price','Oktabr oyida ish kunlari uchun narx','Цена за будние дни в октябре','number','[]','so‘m',false,161,true),
  ('rent_dacha','october_weekend_price','Oktabr oyida dam olish kunlari uchun narx','Цена за выходные дни в октябре','number','[]','so‘m',false,162,true),
  ('rent_dacha','october_extra_guest_price','Oktabr oyida qo‘shimcha odam uchun narx','Цена за дополнительного гостя в октябре','number','[]','so‘m',false,163,true)
on conflict(category_code,code) do update set
  name_uz=excluded.name_uz,
  name_ru=excluded.name_ru,
  data_type=excluded.data_type,
  options=excluded.options,
  unit=excluded.unit,
  sort_order=excluded.sort_order,
  is_active=true;

update public.category_attributes
set name_uz='Dacha kimlar uchun mo‘ljallangan?',
    name_ru='Для кого предназначена дача?',
    data_type='select',
    options='[{"value":"family","label_uz":"Oilalar uchun","label_ru":"Для семей"},{"value":"friends","label_uz":"Do‘stlar uchun","label_ru":"Для друзей"},{"value":"corporate","label_uz":"Korporativ dam olish uchun","label_ru":"Для корпоративного отдыха"},{"value":"all","label_uz":"Barchaga","label_ru":"Для всех"}]',
    sort_order=40,
    is_active=true
where category_code='rent_dacha' and code='guest_types';

update public.category_attributes
set name_uz='Hovuz turi',
    name_ru='Тип бассейна',
    data_type='select',
    options='[{"value":"none","label_uz":"Basseyn yo‘q","label_ru":"Без бассейна"},{"value":"open","label_uz":"Ochiq basseyn","label_ru":"Открытый бассейн"},{"value":"closed","label_uz":"Yopiq basseyn","label_ru":"Закрытый бассейн"},{"value":"both","label_uz":"Ochiq va yopiq basseyn","label_ru":"Открытый и закрытый бассейн"}]',
    is_active=true
where category_code='rent_dacha' and code='pool_type';

update public.category_attributes
set data_type='select',
    options='[{"value":"yes","label_uz":"Ha","label_ru":"Да"},{"value":"no","label_uz":"Yo‘q","label_ru":"Нет"},{"value":"by_agreement","label_uz":"Kelishuv asosida","label_ru":"По договорённости"}]',
    is_active=true
where category_code='rent_dacha' and code in ('pets_allowed','alcohol_allowed');

update public.category_attributes
set name_uz='Nikoh guvohnomasi kerakmi?',
    name_ru='Требуется свидетельство о браке?',
    data_type='select',
    options='[{"value":"yes","label_uz":"Ha","label_ru":"Да"},{"value":"no","label_uz":"Yo‘q","label_ru":"Нет"}]',
    is_active=true
where category_code='rent_dacha' and code='marriage_certificate';

update public.category_attributes
set name_uz='Orientirni kiriting',
    name_ru='Укажите ориентир',
    is_active=true
where category_code='rent_dacha' and code='landmark';

update public.category_attributes
set data_type='select',
    options='[{"value":"12:00","label_uz":"12:00","label_ru":"12:00"},{"value":"14:00","label_uz":"14:00","label_ru":"14:00"},{"value":"15:00","label_uz":"15:00","label_ru":"15:00"},{"value":"16:00","label_uz":"16:00","label_ru":"16:00"},{"value":"17:00","label_uz":"17:00","label_ru":"17:00"},{"value":"18:00","label_uz":"18:00","label_ru":"18:00"},{"value":"19:00","label_uz":"19:00","label_ru":"19:00"},{"value":"20:00","label_uz":"20:00","label_ru":"20:00"}]',
    is_active=true
where category_code='rent_dacha' and code='check_in_time';

update public.category_attributes
set data_type='select',
    options='[{"value":"10:00","label_uz":"10:00","label_ru":"10:00"},{"value":"11:00","label_uz":"11:00","label_ru":"11:00"},{"value":"12:00","label_uz":"12:00","label_ru":"12:00"},{"value":"13:00","label_uz":"13:00","label_ru":"13:00"},{"value":"14:00","label_uz":"14:00","label_ru":"14:00"},{"value":"15:00","label_uz":"15:00","label_ru":"15:00"},{"value":"16:00","label_uz":"16:00","label_ru":"16:00"},{"value":"17:00","label_uz":"17:00","label_ru":"17:00"}]',
    is_active=true
where category_code='rent_dacha' and code='check_out_time';

-- The edit wizard stores dynamic fields in draft_data.attributes. Keep the
-- normalized listing_attribute_values table synchronized as well. This also
-- fixes the generic "E’lonni saqlashda xatolik" path for dacha edits.
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
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select * into v_listing
  from public.listings
  where id=p_listing_id and owner_id=auth.uid()
  for update;

  if not found then raise exception 'LISTING_NOT_FOUND' using errcode='P0002'; end if;
  if v_listing.status not in ('draft','rejected','moderation','active') then
    raise exception 'LISTING_EDIT_FORBIDDEN_FOR_STATUS' using errcode='42501';
  end if;

  v_status := case when v_listing.status='draft' then 'draft' else 'moderation' end;
  v_owner_value := case when coalesce(p_payload->>'ownership_type','')='owner' then 'owner' else null end;
  v_price := nullif(regexp_replace(coalesce(p_payload->>'price',''), '[^0-9.]', '', 'g'), '')::numeric;
  v_area := nullif(p_payload->>'area_m2','')::numeric;
  v_rooms := nullif(p_payload->>'rooms','')::numeric;
  v_floor := nullif(p_payload->>'floor','')::numeric;
  v_floors_total := nullif(p_payload->>'floors_total','')::numeric;
  v_lat := nullif(p_payload->>'latitude','')::numeric;
  v_lng := nullif(p_payload->>'longitude','')::numeric;

  if coalesce(p_payload->>'taxonomy_code','')='' or coalesce(p_payload->>'title','')='' or v_price is null then
    raise exception 'LISTING_REQUIRED_FIELDS_MISSING' using errcode='22023';
  end if;

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

  v_attributes := coalesce(p_payload->'draft_data'->'attributes','{}'::jsonb);

  insert into public.listing_attribute_values(listing_id,attribute_id,value_jsonb,updated_at)
  select
    p_listing_id,
    ca.id,
    coalesce(v_attributes->ca.code,'null'::jsonb),
    now()
  from public.category_attributes ca
  where ca.category_code=p_payload->>'taxonomy_code'
    and ca.is_active
  on conflict(listing_id,attribute_id) do update set
    value_jsonb=excluded.value_jsonb,
    updated_at=now();

  select * into v_listing from public.listings where id=p_listing_id;
  return v_listing;
end;
$$;

revoke all on function public.save_owner_listing(uuid,jsonb) from public, anon;
grant execute on function public.save_owner_listing(uuid,jsonb) to authenticated;
