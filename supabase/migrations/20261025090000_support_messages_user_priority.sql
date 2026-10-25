alter table public.support_messages
  add column if not exists user_id uuid,
  add column if not exists priority integer not null default 0;

create index if not exists support_messages_user_idx on public.support_messages(user_id);
create index if not exists support_messages_priority_idx on public.support_messages(priority desc, created_at asc);
