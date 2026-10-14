begin;

-- The listing-videos bucket remains private. The application creates short-lived
-- signed URLs for active listings, so raw storage objects are never exposed.
drop policy if exists "Public can view active listing videos" on storage.objects;
create policy "Public can view active listing videos"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'listing-videos'
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.status = 'active'
  )
);

commit;
