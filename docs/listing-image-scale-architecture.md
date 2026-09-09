# Prohouse listing image scale architecture

## Goal

Keep the listing workflow unchanged while making image delivery safe for 100,000+ listings and multiple images per listing.

## Current baseline

- Listing images live outside PostgreSQL in the `listing-images` Supabase Storage bucket.
- `public.listing_images` stores metadata including `listing_id`, `image_url`, `sort_order`, and `storage_path`.
- New uploads use a per-user/per-listing Storage path and long cache control.
- Listing search returns only the primary image (`sort_order = 0`) rather than loading all images for every card.

## Rollout order

### Phase 1 — DB/query foundation

- Add a narrow partial index for `listing_images(listing_id)` where `sort_order = 0`.
- Make `/api/listings/search` fetch only primary images.
- Keep the existing image schema and legacy `image_url` values intact.

### Phase 2 — Delivery optimization (implemented, opt-in)

- Public Supabase Storage image URLs used by listing cards can be converted to the Storage Image Transformation endpoint.
- Card delivery is bounded to 640×480 with quality 75 and `cover` resize.
- Supabase can automatically return WebP to compatible clients for transformed images.
- Original objects and database metadata remain unchanged.
- Legacy/external image URLs remain untouched.
- The rollout is gated by `NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS=true`; when the flag is absent or false, the stored URL is returned unchanged. This prevents a production image outage if Storage Image Transformations are not enabled yet.
- The API still returns only the primary image for each search result, so image delivery work stays separate from listing-row query work.

Before enabling the flag in production, enable and verify Supabase Storage Image Transformations for the project. The stored legacy URL remains the fallback and is never rewritten.

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
