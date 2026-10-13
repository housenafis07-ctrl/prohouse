begin;

create table if not exists public.ai_reply_drafts (
  id uuid primary key default gen_random_uuid(),
  support_message_id uuid not null references public.support_messages(id) on delete cascade,
  generated_reply text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review','approved','rejected','sent','send_failed')),
  language text not null default 'uz' check (language in ('uz','ru','other')),
  model text,
  evidence jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  sent_at timestamptz,
  send_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_reply_drafts_message_idx
  on public.ai_reply_drafts(support_message_id, created_at desc);
create index if not exists ai_reply_drafts_review_idx
  on public.ai_reply_drafts(status, created_at desc);

alter table public.ai_reply_drafts enable row level security;
revoke all on public.ai_reply_drafts from anon, authenticated;
grant all on public.ai_reply_drafts to service_role;

create or replace function public.touch_ai_reply_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_reply_drafts_updated_at on public.ai_reply_drafts;
create trigger ai_reply_drafts_updated_at
before update on public.ai_reply_drafts
for each row execute function public.touch_ai_reply_drafts_updated_at();

commit;
