begin;

alter table public.listings
  add column if not exists public_visibility boolean not null default true,
  add column if not exists visibility_reason text;

create index if not exists listings_owner_visibility_idx
  on public.listings(owner_id, public_visibility, status);

commit;
