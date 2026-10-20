begin;

alter table public.telegram_user_links
  add column if not exists verified_at timestamptz,
  add column if not exists verification_method text;

create index if not exists telegram_user_links_verified_idx
  on public.telegram_user_links(telegram_user_id)
  where verified_at is not null;

commit;
