-- Construction media must not remain directly readable after an admin hides it.
-- Public pages now receive short-lived signed URLs only for visible rows.
update storage.buckets
set public = false
where id = 'developer-construction-media';

drop policy if exists "Public read construction media" on storage.objects;
drop policy if exists "Public read developer construction media" on storage.objects;
