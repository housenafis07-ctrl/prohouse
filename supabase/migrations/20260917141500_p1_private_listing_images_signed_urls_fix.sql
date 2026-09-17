begin;

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

  -- Migration/backfill sessions do not carry JWT claims. Only allow the
  -- existing-row URL backfill in that context; application writes require auth.
  if v_user is null and TG_OP = 'UPDATE' and current_setting('request.jwt.claim.role', true) is null then
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

update public.listing_images
set image_url = '/api/listing-images/' || id::text
where storage_path is not null;

commit;
