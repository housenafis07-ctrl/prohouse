# Prohouse listing image scale architecture

## Goal

Keep the listing workflow unchanged while making image delivery safe for 100,000+ listings and multiple images per listing.

## Current baseline

- Listing images live outside PostgreSQL in the `listing-images` Supabase Storage bucket.
- `public.listing_images` stores metadata including `listing_id`, `image_url`, `sort_order`, and `storage_path`.
- New uploads use a per-user/per-listing Storage path and long cache control.
- Listing search returns only the primary image (`sort_order = 0`) rather than loading all images for every card.

## Rollout order

### Phase 1 — DB/query foundation (this change)

- Add a narrow partial index for `listing_images(listing_id)` where `sort_order = 0`.
- Make `/api/listings/search` fetch only primary images.
- Keep the existing image schema and legacy `image_url` values intact.

### Phase 2 — Delivery optimization

- Serve card/grid images through Supabase Storage Image Transformations at a bounded width/quality.
- Keep original objects for the detail/gallery view.
- Use long-lived cache headers for immutable object paths.
- Prefer the transformed WebP response where supported by Supabase.

Supabase documents that Storage can resize/optimize images on demand and that transformed public URLs are cacheable through its CDN. This should be enabled/configured before switching production traffic to transformed URLs.

### Phase 3 — Browser loading

- Listing cards: lazy-load below-the-fold images and use fixed aspect-ratio containers to prevent layout shift.
- Detail page: load the active hero image eagerly; lazy-load thumbnails and non-active gallery images.
- Avoid rendering all full-size gallery images at once.

### Phase 4 — Upload pipeline

- Validate MIME type and dimensions before upload.
- Prefer normalized/optimized uploads for very large originals while retaining the original when business requirements need it.
- Make Storage upload and `listing_images` metadata creation recoverable so failed submissions do not leave orphaned objects.
- Use resumable uploads when file sizes or network conditions justify them.

### Phase 5 — Operational safeguards

- Enforce bucket upload-size limits.
- Monitor Storage egress, image transformation usage, failed uploads and orphaned objects.
- Do not use `storage.list()` as a normal listing query; use `listing_images` metadata in PostgreSQL for application queries.
- Add cleanup tooling for abandoned draft images and deleted listings.

## Important constraint

Do not replace the existing `listing_images` model, listing wizard, moderation workflow, or public listing detail workflow in one large migration. Each phase must be independently buildable and reversible.
