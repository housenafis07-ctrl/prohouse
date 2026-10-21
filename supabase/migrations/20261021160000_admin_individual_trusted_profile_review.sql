begin;

-- Admin audit fields for individual trusted-profile reviews.
-- MyID establishes identity; the admin still approves the RoyalHouse trusted badge.
alter table public.profiles
  add column if not exists trusted_profile_reviewed_at timestamptz,
  add column if not exists trusted_profile_reviewed_by uuid references auth.users(id) on delete set null;

commit;
