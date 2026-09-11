create or replace function public.transition_property_transaction(
  p_transaction_id uuid,
  p_to_status text,
  p_actor_id uuid,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.property_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.property_transactions;
  result public.property_transactions;
begin
  if p_actor_id is null or auth.uid() is null or p_actor_id <> auth.uid() then
    raise exception 'TRANSACTION_ACTOR_FORBIDDEN';
  end if;

  select * into t
  from public.property_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;

  if t.buyer_id <> p_actor_id and t.seller_id <> p_actor_id then
    raise exception 'TRANSACTION_FORBIDDEN';
  end if;

  if p_to_status = 'cancelled' then
    if t.status not in ('lead','viewing','offer','deal','payment') then
      raise exception 'INVALID_TRANSACTION_TRANSITION:%->%', t.status, p_to_status;
    end if;
  elsif t.status = 'lead' and p_to_status = 'viewing' then
    if t.seller_id <> p_actor_id then
      raise exception 'TRANSACTION_ROLE_FORBIDDEN:seller_required';
    end if;
  elsif t.status = 'viewing' and p_to_status = 'offer' then
    if t.buyer_id <> p_actor_id then
      raise exception 'TRANSACTION_ROLE_FORBIDDEN:buyer_required';
    end if;
  elsif t.status = 'offer' and p_to_status = 'deal' then
    if t.seller_id <> p_actor_id then
      raise exception 'TRANSACTION_ROLE_FORBIDDEN:seller_required';
    end if;
  elsif t.status = 'deal' and p_to_status = 'payment' then
    if t.buyer_id <> p_actor_id then
      raise exception 'TRANSACTION_ROLE_FORBIDDEN:buyer_required';
    end if;
  elsif t.status = 'payment' and p_to_status = 'contract' then
    if t.seller_id <> p_actor_id then
      raise exception 'TRANSACTION_ROLE_FORBIDDEN:seller_required';
    end if;
  else
    raise exception 'INVALID_TRANSACTION_TRANSITION:%->%', t.status, p_to_status;
  end if;

  update public.property_transactions
    set status = p_to_status,
        metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
    where id = p_transaction_id
    returning * into result;

  insert into public.property_transaction_events(
    transaction_id, from_status, to_status, actor_id, note, metadata
  )
  values (
    p_transaction_id, t.status, p_to_status, p_actor_id, p_note,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return result;
end;
$$;
