begin;

-- Keep only one upload/processing job per listing, but allow a new upload
-- while an older ready video remains playable. The previous ready video is
-- retired only after the replacement reaches ready in the status endpoint.
drop index if exists public.listing_media_one_live_video_per_listing_idx;

create unique index listing_media_one_live_video_per_listing_idx
  on public.listing_media (listing_id)
  where media_type = 'video'
    and status in ('uploading', 'processing');

commit;
