begin;

alter table public.telegram_link_tokens
  add column if not exists telegram_user_id text;

create index if not exists telegram_link_tokens_pending_user_idx
  on public.telegram_link_tokens(telegram_user_id, created_at desc)
  where used_at is null;

commit;
