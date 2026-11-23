-- Add a dedicated moderation workflow for developer residential complexes.
-- Project lifecycle remains in residential_complexes.status; moderation is tracked separately.

alter table public.residential_complexes
  add column if not exists moderation_status text not null default 'pending',
  add column if not exists moderation_note text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid;

alter table public.residential_complexes
  drop constraint if exists residential_complexes_moderation_status_check;

alter table public.residential_complexes
  add constraint residential_complexes_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'rejected', 'revision_requested'));

create index if not exists idx_residential_complexes_moderation
  on public.residential_complexes (moderation_status, created_at desc);
