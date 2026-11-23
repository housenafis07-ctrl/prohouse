begin;

-- Payme/Click checkout can be started from an order already moved to
-- awaiting_payment by create_monetization_order().
-- The previous 3-argument function incorrectly required status = pending,
-- which made the current Payme adapter reject valid orders.
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

  if v_provider not in ('click', 'payme') then
    raise exception 'UNSUPPORTED_PAYMENT_PROVIDER' using errcode = '22023';
  end if;

  if v_key = '' or length(v_key) > 128 then
    raise exception 'INVALID_PAYMENT_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select *
  into v_order
  from public.monetization_orders
  where id = p_order_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_order.status not in ('pending', 'awaiting_payment') then
    raise exception 'ORDER_NOT_PAYABLE' using errcode = 'P0001';
  end if;

  if v_order.provider not in ('unconfigured', v_provider) then
    raise exception 'PAYMENT_PROVIDER_MISMATCH' using errcode = 'P0001';
  end if;

  select *
  into v_attempt
  from public.monetization_payment_attempts
  where idempotency_key = v_key;

  if found then
    if v_attempt.order_id <> v_order.id
       or v_attempt.provider <> v_provider
       or v_attempt.user_id <> v_user_id then
      raise exception 'PAYMENT_IDEMPOTENCY_KEY_CONFLICT' using errcode = '23505';
    end if;
    return v_attempt;
  end if;

  -- One active attempt per order/provider. A cancelled attempt may be
  -- replaced by a new one, while a pending/processing attempt is reused.
  select *
  into v_attempt
  from public.monetization_payment_attempts
  where order_id = v_order.id
    and provider = v_provider
    and status in ('pending', 'processing')
  order by created_at desc
  limit 1;

  if found then
    return v_attempt;
  end if;

  insert into public.monetization_payment_attempts (
    order_id,
    user_id,
    provider,
    provider_prepare_id,
    status,
    amount_uzs,
    currency,
    idempotency_key
  )
  values (
    v_order.id,
    v_user_id,
    v_provider,
    case when v_provider = 'click'
      then nextval('public.monetization_click_prepare_seq')::bigint
      else null
    end,
    'pending',
    v_order.subtotal_uzs,
    v_order.currency,
    v_key
  )
  returning * into v_attempt;

  update public.monetization_orders
  set
    status = 'awaiting_payment',
    provider = v_provider,
    updated_at = now()
  where id = v_order.id;

  return v_attempt;
end;
$$;

revoke all on function public.create_monetization_payment_attempt(uuid, text, text) from public, anon;
grant execute on function public.create_monetization_payment_attempt(uuid, text, text) to authenticated;

-- Defense-in-depth against concurrent checkout requests.
create unique index if not exists monetization_payment_attempts_active_order_provider_key
  on public.monetization_payment_attempts(order_id, provider)
  where status in ('pending', 'processing');

commit;
