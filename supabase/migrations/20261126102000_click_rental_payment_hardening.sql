begin;

create or replace function public.complete_click_monetization_payment(
  p_attempt_id uuid,
  p_click_trans_id text,
  p_click_paydoc_id bigint,
  p_amount_uzs numeric,
  p_click_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.monetization_payment_attempts%rowtype;
  v_order public.monetization_orders%rowtype;
  v_paid_at timestamptz := now();
begin
  select * into v_attempt
  from public.monetization_payment_attempts
  where id = p_attempt_id and provider = 'click'
  for update;

  if not found then raise exception 'CLICK_ATTEMPT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_attempt.currency <> 'UZS' or v_attempt.amount_uzs <> p_amount_uzs then
    raise exception 'CLICK_AMOUNT_MISMATCH' using errcode = '22023';
  end if;
  if v_attempt.provider_payment_id is not null and v_attempt.provider_payment_id <> p_click_trans_id then
    raise exception 'CLICK_TRANSACTION_MISMATCH' using errcode = '23505';
  end if;
  if v_attempt.status not in ('processing', 'paid') then
    raise exception 'CLICK_ATTEMPT_NOT_PROCESSING' using errcode = 'P0001';
  end if;

  select * into v_order from public.monetization_orders where id = v_attempt.order_id for update;
  if not found then raise exception 'CLICK_ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_order.status not in ('awaiting_payment', 'pending', 'paid') or v_order.provider not in ('click', 'unconfigured') then
    raise exception 'CLICK_ORDER_NOT_PAYABLE' using errcode = 'P0001';
  end if;

  if v_attempt.status <> 'paid' then
    update public.monetization_payment_attempts
    set status = 'paid',
        provider_payment_id = p_click_trans_id,
        provider_paydoc_id = p_click_paydoc_id,
        provider_payload = coalesce(provider_payload, '{}'::jsonb) || jsonb_build_object('click', coalesce(p_click_payload, '{}'::jsonb)),
        paid_at = v_paid_at,
        updated_at = v_paid_at
    where id = v_attempt.id;
  end if;

  update public.monetization_orders
  set status = 'paid', provider = 'click', provider_order_id = p_click_trans_id, updated_at = v_paid_at
  where id = v_order.id;

  perform public.activate_monetization_order(v_order.id);
  return jsonb_build_object('paid', true, 'order_id', v_order.id);
end;
$$;

create or replace function public.complete_click_rental_payment(
  p_booking_id uuid,
  p_click_trans_id text,
  p_click_paydoc_id bigint,
  p_amount_uzs numeric,
  p_click_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.rental_bookings%rowtype;
  v_paid_at timestamptz := now();
  v_payload jsonb;
begin
  select * into v_booking
  from public.rental_bookings
  where id = p_booking_id and payment_provider = 'click'
  for update;

  if not found then raise exception 'CLICK_BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_booking.currency <> 'UZS' or round(v_booking.deposit_amount) <> p_amount_uzs then
    raise exception 'CLICK_AMOUNT_MISMATCH' using errcode = '22023';
  end if;
  if v_booking.provider_payment_id is not null and v_booking.provider_payment_id <> p_click_trans_id then
    raise exception 'CLICK_TRANSACTION_MISMATCH' using errcode = '23505';
  end if;
  if v_booking.payment_status = 'paid' and v_booking.status = 'confirmed' then
    return jsonb_build_object('paid', true, 'already_paid', true, 'booking_id', v_booking.id);
  end if;
  if v_booking.payment_status <> 'processing' or v_booking.status <> 'pending_payment' then
    return jsonb_build_object('paid', false, 'reason', 'BOOKING_NOT_PROCESSING');
  end if;

  v_payload := coalesce(v_booking.provider_payload, '{}'::jsonb)
    || jsonb_build_object('click', coalesce(p_click_payload, '{}'::jsonb) || jsonb_build_object('perform_time', (extract(epoch from v_paid_at) * 1000)::bigint));

  update public.rental_bookings
  set payment_status = 'paid',
      status = 'confirmed',
      provider_payment_id = p_click_trans_id,
      paid_at = v_paid_at,
      provider_payload = v_payload,
      updated_at = v_paid_at
  where id = v_booking.id and payment_status = 'processing' and status = 'pending_payment';

  return jsonb_build_object('paid', true, 'already_paid', false, 'booking_id', v_booking.id);
end;
$$;

revoke all on function public.complete_click_monetization_payment(uuid, text, bigint, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.complete_click_rental_payment(uuid, text, bigint, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.complete_click_monetization_payment(uuid, text, bigint, numeric, jsonb) to service_role;
grant execute on function public.complete_click_rental_payment(uuid, text, bigint, numeric, jsonb) to service_role;

commit;
