begin;

create table if not exists public.monetization_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.monetization_orders(id) on delete cascade,
  provider text not null check (provider in ('click','payme')),
  provider_payment_id text,
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','cancelled')),
  amount_uzs numeric(14,2) not null check (amount_uzs > 0),
  currency text not null default 'UZS' check (currency = 'UZS'),
  idempotency_key text not null,
  provider_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monetization_payment_attempts_idempotency_key_key unique (idempotency_key)
);

create index if not exists idx_payment_attempts_order_id
  on public.monetization_payment_attempts(order_id);

create index if not exists idx_payment_attempts_provider_payment_id
  on public.monetization_payment_attempts(provider, provider_payment_id)
  where provider_payment_id is not null;

revoke all on table public.monetization_payment_attempts from anon, authenticated;
grant select on table public.monetization_payment_attempts to authenticated;
revoke all on table public.monetization_payment_attempts from service_role;
grant select, insert, update, delete on table public.monetization_payment_attempts to service_role;

create or replace function public.create_monetization_payment_attempt(
  p_order_id uuid,
  p_provider text,
  p_idempotency_key text
)
returns public.monetization_payment_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.monetization_orders;
  v_attempt public.monetization_payment_attempts;
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_key text := btrim(coalesce(p_idempotency_key, ''));
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_order_id is null then
    raise exception 'ORDER_REQUIRED' using errcode = '22023';
  end if;
  if v_provider not in ('click','payme') then
    raise exception 'UNSUPPORTED_PAYMENT_PROVIDER' using errcode = '22023';
  end if;
  if v_key = '' or length(v_key) > 128 then
    raise exception 'INVALID_PAYMENT_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select * into v_order
  from public.monetization_orders
  where id = p_order_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'ORDER_NOT_PAYABLE' using errcode = 'P0001';
  end if;

  select * into v_attempt
  from public.monetization_payment_attempts
  where idempotency_key = v_key;

  if found then
    if v_attempt.order_id <> v_order.id or v_attempt.provider <> v_provider then
      raise exception 'PAYMENT_IDEMPOTENCY_KEY_CONFLICT' using errcode = '23505';
    end if;
    return v_attempt;
  end if;

  insert into public.monetization_payment_attempts (
    order_id, provider, status, amount_uzs, currency, idempotency_key
  ) values (
    v_order.id, v_provider, 'pending', v_order.subtotal_uzs, v_order.currency, v_key
  )
  returning * into v_attempt;

  return v_attempt;
end;
$$;

revoke all on function public.create_monetization_payment_attempt(uuid,text,text) from public, anon;
grant execute on function public.create_monetization_payment_attempt(uuid,text,text) to authenticated;

commit;
