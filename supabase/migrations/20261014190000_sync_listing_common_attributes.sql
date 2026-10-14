-- Keep common searchable/display fields in sync with the dynamic attribute payload.
-- Some wizard saves send an empty string in the top-level field while the same
-- value is present under draft_data.attributes. COALESCE alone cannot handle
-- that case because an empty string is not NULL before numeric normalization.

create or replace function public.sync_listing_common_attributes()
returns trigger
language plpgsql
as $$
declare
  attrs jsonb := case
    when jsonb_typeof(new.draft_data->'attributes') = 'object' then new.draft_data->'attributes'
    else '{}'::jsonb
  end;
  v text;
begin
  if new.area_m2 is null then
    v := nullif(btrim(attrs->>'area_m2'), '');
    if v ~ '^[-+]?[0-9]+(\\.[0-9]+)?$' then
      new.area_m2 := v::numeric;
    end if;
  end if;

  if new.rooms is null then
    v := nullif(btrim(attrs->>'rooms'), '');
    if v ~ '^[-+]?[0-9]+(\\.[0-9]+)?$' then
      new.rooms := v::numeric;
    end if;
  end if;

  if new.floor is null then
    v := nullif(btrim(attrs->>'floor'), '');
    if v ~ '^[-+]?[0-9]+(\\.[0-9]+)?$' then
      new.floor := v::numeric;
    end if;
  end if;

  if new.floors_total is null then
    v := nullif(btrim(attrs->>'floors_total'), '');
    if v ~ '^[-+]?[0-9]+(\\.[0-9]+)?$' then
      new.floors_total := v::numeric;
    end if;
  end if;

  if new.land_area is null then
    v := nullif(btrim(attrs->>'land_area'), '');
    if v ~ '^[-+]?[0-9]+(\\.[0-9]+)?$' then
      new.land_area := v::numeric;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_listing_common_attributes on public.listings;
create trigger trg_sync_listing_common_attributes
before insert or update of draft_data, area_m2, rooms, floor, floors_total, land_area
on public.listings
for each row
execute function public.sync_listing_common_attributes();

-- Repair existing listings where the values are already present in the draft
-- payload but the mirrored columns are NULL. This makes the current listings
-- immediately visible to listing_search and all existing cards/detail pages.
update public.listings
set
  area_m2 = case
    when area_m2 is null
      and btrim(coalesce(draft_data->'attributes'->>'area_m2', '')) ~ '^[-+]?[0-9]+(\\.[0-9]+)?$'
    then btrim(draft_data->'attributes'->>'area_m2')::numeric
    else area_m2
  end,
  rooms = case
    when rooms is null
      and btrim(coalesce(draft_data->'attributes'->>'rooms', '')) ~ '^[-+]?[0-9]+(\\.[0-9]+)?$'
    then btrim(draft_data->'attributes'->>'rooms')::numeric
    else rooms
  end,
  floor = case
    when floor is null
      and btrim(coalesce(draft_data->'attributes'->>'floor', '')) ~ '^[-+]?[0-9]+(\\.[0-9]+)?$'
    then btrim(draft_data->'attributes'->>'floor')::numeric
    else floor
  end,
  floors_total = case
    when floors_total is null
      and btrim(coalesce(draft_data->'attributes'->>'floors_total', '')) ~ '^[-+]?[0-9]+(\\.[0-9]+)?$'
    then btrim(draft_data->'attributes'->>'floors_total')::numeric
    else floors_total
  end,
  land_area = case
    when land_area is null
      and btrim(coalesce(draft_data->'attributes'->>'land_area', '')) ~ '^[-+]?[0-9]+(\\.[0-9]+)?$'
    then btrim(draft_data->'attributes'->>'land_area')::numeric
    else land_area
  end
where draft_data is not null
  and jsonb_typeof(draft_data->'attributes') = 'object'
  and (
    area_m2 is null or rooms is null or floor is null or floors_total is null or land_area is null
  );
