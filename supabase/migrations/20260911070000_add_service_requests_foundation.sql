create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  service_type text not null check (service_type in ('mortgage','insurance','legal','cadastral','property_service')),
  status text not null default 'new' check (status in ('new','qualified','submitted','in_progress','completed','cancelled')),
  requested_amount numeric(18,2),
  down_payment numeric(18,2),
  term_months integer,
  contact_phone text,
  notes text,
  partner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_requests_amount_positive check (requested_amount is null or requested_amount > 0),
  constraint service_requests_down_payment_nonnegative check (down_payment is null or down_payment >= 0),
  constraint service_requests_term_positive check (term_months is null or term_months > 0)
);

create index if not exists service_requests_user_idx on public.service_requests(user_id, created_at desc);
create index if not exists service_requests_listing_idx on public.service_requests(listing_id, created_at desc);
create index if not exists service_requests_type_status_idx on public.service_requests(service_type, status, created_at desc);

alter table public.service_requests enable row level security;
drop policy if exists service_requests_select_own on public.service_requests;
create policy service_requests_select_own on public.service_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists service_requests_insert_own on public.service_requests;
create policy service_requests_insert_own on public.service_requests for insert to authenticated with check (user_id = auth.uid());

create or replace function public.touch_service_request_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists service_requests_touch_updated_at on public.service_requests;
create trigger service_requests_touch_updated_at before update on public.service_requests for each row execute function public.touch_service_request_updated_at();
