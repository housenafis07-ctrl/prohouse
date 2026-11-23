begin;

-- RoyalHouse listing video foundation.
--
-- Videos are deliberately kept separate from listing_images so the existing
-- image contract remains untouched. The application can later switch the
-- video provider (for example, Supabase Storage -> a dedicated video CDN)
-- without changing the listing schema.

create table if not exists public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  media_type text not null,
  provider text not null default 'supabase',
  status text not null default 'uploading',
  original_storage_path text,
  processed_storage_path text,
  thumbnail_storage_path text,
  playback_url text,
  mime_type text,
  original_mime_type text,
  duration_seconds numeric,
  width integer,
  height integer,
  size_bytes bigint,
  original_size_bytes bigint,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_media_type_check check (media_type in ('video')),
  constraint listing_media_provider_check check (provider in ('supabase', 'cloudflare')),
  constraint listing_media_status_check check (status in ('uploading', 'processing', 'ready', 'failed', 'deleted')),
  constraint listing_media_sort_order_check check (sort_order >= 0),
  constraint listing_media_duration_check check (duration_seconds is null or duration_seconds >= 0),
  constraint listing_media_dimensions_check check (
    (width is null or width > 0)
    and (height is null or height > 0)
  ),
  constraint listing_media_size_check check (
    (size_bytes is null or size_bytes >= 0)
    and (original_size_bytes is null or original_size_bytes >= 0)
  )
);

create index if not exists listing_media_listing_id_idx
  on public.listing_media (listing_id, sort_order);

create index if not exists listing_media_status_idx
  on public.listing_media (status);

-- A listing may have multiple future media records, but only one active video
-- is needed for the first player UX. Failed/deleted/old records do not block a
-- replacement upload.
create unique index if not exists listing_media_one_live_video_per_listing_idx
  on public.listing_media (listing_id)
  where media_type = 'video' and status in ('uploading', 'processing', 'ready');

alter table public.listing_media enable row level security;

drop policy if exists "Public can view ready listing videos" on public.listing_media;
create policy "Public can view ready listing videos"
on public.listing_media
for select
to anon, authenticated
using (
  media_type = 'video'
  and status = 'ready'
  and exists (
    select 1
    from public.listings l
    where l.id = listing_media.listing_id
      and l.status = 'active'
  )
);

drop policy if exists "Owners can view own listing video records" on public.listing_media;
create policy "Owners can view own listing video records"
on public.listing_media
for select
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_media.listing_id
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "Owners can insert own listing video records" on public.listing_media;
create policy "Owners can insert own listing video records"
on public.listing_media
for insert
to authenticated
with check (
  exists (
    select 1
    from public.listings l
    where l.id = listing_media.listing_id
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "Owners can update own listing video records" on public.listing_media;
create policy "Owners can update own listing video records"
on public.listing_media
for update
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_media.listing_id
      and l.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.listings l
    where l.id = listing_media.listing_id
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "Owners can delete own listing video records" on public.listing_media;
create policy "Owners can delete own listing video records"
on public.listing_media
for delete
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_media.listing_id
      and l.owner_id = auth.uid()
  )
);

-- Private bucket: video playback will go through an application-controlled
-- signed URL endpoint. Do not expose raw Storage URLs to the client.
insert into storage.buckets (id, name, public)
values ('listing-videos', 'listing-videos', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can upload own listing videos" on storage.objects;
create policy "Users can upload own listing videos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "Users can view own listing videos" on storage.objects;
create policy "Users can view own listing videos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'listing-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "Users can update own listing videos" on storage.objects;
create policy "Users can update own listing videos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'listing-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.owner_id = auth.uid()
  )
)
with check (
  bucket_id = 'listing-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "Users can delete own listing videos" on storage.objects;
create policy "Users can delete own listing videos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.owner_id = auth.uid()
  )
);

commit;
