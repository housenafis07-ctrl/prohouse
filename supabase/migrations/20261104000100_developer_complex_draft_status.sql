-- Developer complexes are drafts until the developer completes all required information.
-- Submitted complexes transition to pending and become visible in the admin moderation queue.
alter table public.residential_complexes
  drop constraint if exists residential_complexes_moderation_status_check;

alter table public.residential_complexes
  add constraint residential_complexes_moderation_status_check
  check (moderation_status = any (array['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'revision_requested'::text]));

-- Existing rows remain unchanged. New developer-created complexes are explicitly inserted as draft by the API.
