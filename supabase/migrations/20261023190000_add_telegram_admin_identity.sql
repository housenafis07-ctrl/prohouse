begin;

alter table public.telegram_bot_users
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists telegram_bot_users_auth_user_id_uidx
  on public.telegram_bot_users(auth_user_id)
  where auth_user_id is not null;

alter table public.telegram_link_tokens
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

alter table public.telegram_link_tokens
  alter column profile_id drop not null;

create index if not exists telegram_link_tokens_auth_user_idx
  on public.telegram_link_tokens(auth_user_id)
  where auth_user_id is not null;

commit;
