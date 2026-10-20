begin;

alter table public.telegram_user_links
  add column if not exists verified_at timestamptz;

alter table public.telegram_user_links
  add column if not exists verification_method text;

-- Existing links were created by the old Telegram auto-link flow. They must
-- not be treated as proof of ownership after the identity-confusion bug.
-- Users will re-verify their phone once, then the link becomes trusted.
update public.telegram_user_links
set verified_at = null,
    verification_method = null
where verified_at is not null;

commit;
