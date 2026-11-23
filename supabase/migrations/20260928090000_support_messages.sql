create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  subject text not null default 'Umumiy murojaat',
  message text not null,
  source text not null default 'website' check (source in ('website','telegram','system')),
  telegram_user_id text,
  telegram_username text,
  status text not null default 'new' check (status in ('new','in_progress','replied','closed')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_messages_status_idx on public.support_messages(status, created_at desc);
create index if not exists support_messages_created_idx on public.support_messages(created_at desc);
create index if not exists support_messages_telegram_user_idx on public.support_messages(telegram_user_id);

alter table public.support_messages enable row level security;

drop policy if exists "support_messages_no_public_read" on public.support_messages;
drop policy if exists "support_messages_no_public_write" on public.support_messages;

create policy "support_messages_no_public_read"
  on public.support_messages for select
  to anon, authenticated
  using (false);

create policy "support_messages_no_public_write"
  on public.support_messages for insert
  to anon, authenticated
  with check (false);

create or replace function public.touch_support_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_messages_updated_at on public.support_messages;
create trigger support_messages_updated_at
before update on public.support_messages
for each row execute function public.touch_support_messages_updated_at();
