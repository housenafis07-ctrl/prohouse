-- Realtor benefit-period dates are managed independently from verification and listing quotas.
-- Existing realtor records remain unchanged; no trial duration is assumed or auto-assigned.
alter table public.realtor_profiles
  add column if not exists benefit_period_starts_at timestamptz,
  add column if not exists benefit_period_ends_at timestamptz,
  add column if not exists benefit_period_note text;
alter table public.realtor_profiles drop constraint if exists realtor_benefit_period_dates_check;
alter table public.realtor_profiles add constraint realtor_benefit_period_dates_check
  check (benefit_period_starts_at is null or benefit_period_ends_at is null or benefit_period_ends_at > benefit_period_starts_at);
create index if not exists realtor_profiles_benefit_period_ends_idx
  on public.realtor_profiles (benefit_period_ends_at) where benefit_period_ends_at is not null;
