-- Mortgage identity verification: private documents and explicit consent metadata.
alter table public.mortgage_leads
  add column if not exists pinfl text,
  add column if not exists date_of_birth date,
  add column if not exists passport_series_number text,
  add column if not exists identity_document_front_path text,
  add column if not exists identity_document_back_path text,
  add column if not exists identity_selfie_path text,
  add column if not exists identity_submitted_at timestamptz,
  add column if not exists personal_data_consent_at timestamptz,
  add column if not exists personal_data_consent_version text;

-- Existing mortgage lead indexes remain unchanged; no PINFL index is created.
-- Private bucket. Files are only accessed through authenticated server routes
-- that verify lead ownership or admin permissions before issuing short-lived URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mortgage-identity',
  'mortgage-identity',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
