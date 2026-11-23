-- Run after the developer moderation migration has created moderation_status.
-- Developer-created complexes stay private drafts until the complete submission is sent.
alter table public.residential_complexes
  drop constraint if exists residential_complexes_moderation_status_check;

alter table public.residential_complexes
  add constraint residential_complexes_moderation_status_check
  check (moderation_status in ('draft', 'pending', 'approved', 'rejected', 'revision_requested'));

-- Existing records are intentionally left unchanged.
