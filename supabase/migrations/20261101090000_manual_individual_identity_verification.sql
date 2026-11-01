begin;

-- Manual identity verification reuses the existing private partner document bucket/table.
-- partner_profile_id is nullable already, allowing individual accounts to submit identity files.
alter table public.profiles
  add column if not exists manual_verification_status text,
  add column if not exists manual_verification_reviewed_at timestamptz,
  add column if not exists manual_verification_reviewed_by uuid references auth.users(id) on delete set null;

create index if not exists partner_verification_documents_individual_review_idx
  on public.partner_verification_documents(user_id, status, created_at desc);

-- The bucket must remain private: admin access is via short-lived signed URLs only.
update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']::text[]
where id = 'partner-verification-documents';

commit;
