begin;

-- The bucket must never expose listing images through a bucket-wide public URL.
update storage.buckets
set public = false
where id = 'listing-images';

-- Remove the old bucket-wide read policy. Active listings are served through the
-- application authorization endpoint, which issues short-lived signed URLs.
drop policy if exists "Public can view listing images" on storage.objects;

-- Keep direct authenticated Storage reads limited to objects whose canonical
-- path belongs to the requesting user's own listing.
drop policy if exists "Users can view own listing images" on storage.objects;
create policy "Users can view own listing images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.owner_id = auth.uid()
  )
);

-- Never persist a caller-controlled public Storage URL. Store an application
-- URL keyed by listing_images.id; the API route authorizes access and signs the
-- canonical storage_path server-side.
create or replace function public.normalize_listing_image_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_first text;
  v_second text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    if new.storage_path is not null then
      new.image_url := '/api/listing-images/' || new.id::text;
    end if;
    return new;
  end if;

  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if new.storage_path is null then
    raise exception 'LISTING_IMAGE_STORAGE_PATH_REQUIRED' using errcode = '23514';
  end if;

  v_first := (storage.foldername(new.storage_path))[1];
  v_second := (storage.foldername(new.storage_path))[2];

  if v_first is distinct from v_user::text or v_second is distinct from new.listing_id::text then
    raise exception 'LISTING_IMAGE_PATH_MISMATCH' using errcode = '42501';
  end if;

  new.image_url := '/api/listing-images/' || new.id::text;
  return new;
end;
$$;

drop trigger if exists trg_normalize_listing_image_reference on public.listing_images;
create trigger trg_normalize_listing_image_reference
before insert or update of listing_id, storage_path, image_url
on public.listing_images
for each row
execute function public.normalize_listing_image_reference();

-- Backfill existing Storage-backed rows to the authorized application URL.
update public.listing_images
set image_url = '/api/listing-images/' || id::text
where storage_path is not null;

commit;
