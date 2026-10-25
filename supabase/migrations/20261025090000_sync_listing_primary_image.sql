create or replace function public.sync_listing_primary_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_primary_image text;
begin
  v_listing_id := coalesce(new.listing_id, old.listing_id);

  select li.image_url
    into v_primary_image
  from public.listing_images li
  where li.listing_id = v_listing_id
  order by li.sort_order asc, li.created_at asc nulls last, li.id asc
  limit 1;

  update public.listings
  set primary_image_url = v_primary_image
  where id = v_listing_id;

  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_listing_primary_image() from public, anon;

-- Keep the legacy/card field synchronized for every image change.
drop trigger if exists listing_images_sync_primary_image on public.listing_images;
create trigger listing_images_sync_primary_image
after insert or update of image_url, sort_order or delete on public.listing_images
for each row execute function public.sync_listing_primary_image();

-- Backfill existing listings, including older service listings whose images
-- already exist in listing_images but primary_image_url was never populated.
update public.listings l
set primary_image_url = first_image.image_url
from (
  select distinct on (listing_id)
    listing_id,
    image_url
  from public.listing_images
  order by listing_id, sort_order asc, created_at asc nulls last, id asc
) first_image
where l.id = first_image.listing_id
  and (l.primary_image_url is null or l.primary_image_url = '');

-- Clear stale values where all images were deleted.
update public.listings l
set primary_image_url = null
where not exists (
  select 1 from public.listing_images li where li.listing_id = l.id
)
and l.primary_image_url is not null;
