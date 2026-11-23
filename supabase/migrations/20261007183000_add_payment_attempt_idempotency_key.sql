begin;

-- The production database still has the earlier monetization_payment_attempts
-- shape without idempotency_key, while the Payme/Click payment flows depend on
-- that field for idempotent payment-attempt creation.
alter table public.monetization_payment_attempts
  add column if not exists idempotency_key text;

-- Preserve any pre-existing attempts before enforcing the uniqueness contract.
update public.monetization_payment_attempts
set idempotency_key = 'legacy:' || id::text
where idempotency_key is null;

alter table public.monetization_payment_attempts
  alter column idempotency_key set not null;

create unique index if not exists monetization_payment_attempts_idempotency_key_key
  on public.monetization_payment_attempts(idempotency_key);

commit;
