create table if not exists public.listing_leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  visitor_id uuid references auth.users(id) on delete set null,
  lead_type text not null check (lead_type in ('call','chat')),
  status text not null default 'new' check (status in ('new','contacted','closed','spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listing_leads_listing_id_idx on public.listing_leads(listing_id, created_at desc);
create index if not exists listing_leads_owner_id_idx on public.listing_leads(owner_id, created_at desc);

alter table public.listing_leads enable row level security;

drop policy if exists "listing_leads_insert_authenticated" on public.listing_leads;
create policy "listing_leads_insert_authenticated" on public.listing_leads for insert to authenticated with check (visitor_id = auth.uid());

drop policy if exists "listing_leads_read_participants" on public.listing_leads;
create policy "listing_leads_read_participants" on public.listing_leads for select to authenticated using (visitor_id = auth.uid() or owner_id = auth.uid());

create or replace function public.touch_listing_lead_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists listing_leads_touch_updated_at on public.listing_leads;
create trigger listing_leads_touch_updated_at before update on public.listing_leads for each row execute function public.touch_listing_lead_updated_at();
