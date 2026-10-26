begin;

alter table public.telegram_bot_users
  add column if not exists onboarding_version integer not null default 0;

commit;
