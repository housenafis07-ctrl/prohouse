begin;

create or replace function public.enforce_required_listing_attributes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_missing text;
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
      lav.id is null
      or lav.value_jsonb is null
      or (jsonb_typeof(lav.value_jsonb) = 'string' and nullif(btrim(lav.value_jsonb #>> '{}'), '') is null)
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

revoke all on function public.enforce_required_listing_attributes() from public, anon, authenticated;
grant execute on function public.enforce_required_listing_attributes() to service_role;

commit;
