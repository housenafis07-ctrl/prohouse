begin;

-- Telegram bot audience registry.
-- Every private /start is recorded here so admin broadcasts do not depend on a
-- manually configured TELEGRAM_ADMIN_CHAT_ID.
create table if not exists public.telegram_bot_users (
  id bigint generated always as identity primary key,
  telegram_user_id text not null unique,
  chat_id text not null,
  chat_type text not null default 'private',
  telegram_username text,
  first_name text,
  last_name text,
  profile_id uuid references public.profiles(id) on delete set null,
  is_blocked boolean not null default false,
  first_started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists telegram_bot_users_chat_id_idx
  on public.telegram_bot_users(chat_id);
create index if not exists telegram_bot_users_profile_id_idx
  on public.telegram_bot_users(profile_id);
create index if not exists telegram_bot_users_last_seen_idx
  on public.telegram_bot_users(last_seen_at desc);
create index if not exists telegram_bot_users_active_idx
  on public.telegram_bot_users(is_blocked, chat_type);

alter table public.telegram_bot_users enable row level security;
revoke all on public.telegram_bot_users from anon, authenticated;
grant all on public.telegram_bot_users to service_role;

create or replace function public.set_telegram_bot_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists telegram_bot_users_updated_at on public.telegram_bot_users;
create trigger telegram_bot_users_updated_at
before update on public.telegram_bot_users
for each row execute function public.set_telegram_bot_users_updated_at();

commit;
