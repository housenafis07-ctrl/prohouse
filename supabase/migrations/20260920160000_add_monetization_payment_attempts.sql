create table if not exists public.monetization_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.monetization_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  status text not null default 'created',
  amount_uzs numeric not null check (amount_uzs >= 0),
  currency text not null default 'UZS',
  checkout_url text,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists monetization_payment_attempts_order_idx
  on public.monetization_payment_attempts(order_id, created_at desc);
create index if not exists monetization_payment_attempts_provider_idx
  on public.monetization_payment_attempts(provider, provider_payment_id);

alter table public.monetization_payment_attempts enable row level security;

drop policy if exists "Users can view own payment attempts" on public.monetization_payment_attempts;
create policy "Users can view own payment attempts"
on public.monetization_payment_attempts
for select to authenticated
using (user_id = auth.uid());

revoke all on table public.monetization_payment_attempts from anon, authenticated;
grant select on table public.monetization_payment_attempts to authenticated;

create or replace function public.create_monetization_payment_attempt(p_order_id uuid, p_provider text)
returns public.monetization_payment_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.monetization_orders;
  v_attempt public.monetization_payment_attempts;
  v_provider text := lower(btrim(coalesce(p_provider,'')));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if v_provider = '' or length(v_provider) > 40 then raise exception 'INVALID_PAYMENT_PROVIDER' using errcode='22023'; end if;

  select * into v_order
  from public.monetization_orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
  if v_order.status not in ('pending','awaiting_payment') then
    raise exception 'ORDER_NOT_PAYABLE' using errcode='22023';
  end if;

  select * into v_attempt
  from public.monetization_payment_attempts
  where order_id = v_order.id and provider = v_provider and status in ('created','redirected')
  order by created_at desc
  limit 1;

  if found then return v_attempt; end if;

  insert into public.monetization_payment_attempts(order_id,user_id,provider,status,amount_uzs,currency)
  values(v_order.id,auth.uid(),v_provider,'created',v_order.subtotal_uzs,v_order.currency)
  returning * into v_attempt;

  update public.monetization_orders
  set status='awaiting_payment', provider=v_provider, updated_at=now()
  where id=v_order.id;

  return v_attempt;
end;
$$;

revoke all on function public.create_monetization_payment_attempt(uuid,text) from public, anon;
grant execute on function public.create_monetization_payment_attempt(uuid,text) to authenticated;
