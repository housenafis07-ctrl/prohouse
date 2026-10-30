alter table public.realtor_profiles
  add column if not exists verification_rejection_reason text,
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists verification_reviewed_by uuid references auth.users(id) on delete set null;

create index if not exists realtor_profiles_verification_status_created_at_idx
  on public.realtor_profiles (verification_status, created_at desc);
