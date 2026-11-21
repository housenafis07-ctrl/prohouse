begin;

-- Backward-compatible repair for installations where the historical table
-- was created with admin_id instead of admin_user_id.
alter table public.listing_moderation_history
  add column if not exists admin_user_id uuid references auth.users(id) on delete set null;
alter table public.listing_moderation_history
  add column if not exists moderator_telegram_id text;
alter table public.listing_moderation_history
  add column if not exists action text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listing_moderation_history'
      and column_name = 'admin_id'
  ) then
    execute 'update public.listing_moderation_history set admin_user_id = admin_id where admin_user_id is null';
  end if;
end $$;

create index if not exists listing_moderation_history_admin_user_idx
  on public.listing_moderation_history(admin_user_id, created_at desc);

create index if not exists listing_moderation_history_telegram_moderator_idx
  on public.listing_moderation_history(moderator_telegram_id, created_at desc)
  where moderator_telegram_id is not null;

create table if not exists public.telegram_moderators (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text not null unique,
  chat_id text not null,
  username text,
  first_name text,
  is_active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint telegram_moderators_user_id_numeric check (telegram_user_id ~ '^[0-9]+$')
);

create table if not exists public.telegram_moderator_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_telegram_id text,
  created_at timestamptz not null default now()
);

create index if not exists telegram_moderators_active_idx
  on public.telegram_moderators(is_active, created_at desc);
create index if not exists telegram_moderator_invites_expiry_idx
  on public.telegram_moderator_invites(expires_at)
  where used_at is null;

alter table public.telegram_moderators enable row level security;
alter table public.telegram_moderator_invites enable row level security;

revoke all on public.telegram_moderators from anon, authenticated;
revoke all on public.telegram_moderator_invites from anon, authenticated;
grant all on public.telegram_moderators to service_role;
grant all on public.telegram_moderator_invites to service_role;

commit;
