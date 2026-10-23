begin;

create table if not exists public.listing_moderation_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  admin_id uuid null references auth.users(id) on delete set null,
  from_status text,
  to_status text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists listing_moderation_history_listing_idx
  on public.listing_moderation_history (listing_id, created_at desc);

create index if not exists listing_moderation_history_admin_idx
  on public.listing_moderation_history (admin_id, created_at desc);

alter table public.listing_moderation_history enable row level security;

commit;
