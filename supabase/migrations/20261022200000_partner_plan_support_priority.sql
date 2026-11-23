begin;

alter table public.support_messages
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists priority integer not null default 0;

create index if not exists support_messages_priority_idx
  on public.support_messages(priority desc, created_at asc);

-- Priority support is a real queue signal: BUSINESS messages are surfaced
-- before ordinary support requests in the admin inbox.
commit;
