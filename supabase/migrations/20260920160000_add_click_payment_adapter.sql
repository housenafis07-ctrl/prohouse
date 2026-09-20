begin;

alter table public.monetization_payment_attempts
  add column if not exists provider_prepare_id bigint,
  add column if not exists provider_paydoc_id bigint;

create unique index if not exists monetization_payment_attempts_provider_payment_key
  on public.monetization_payment_attempts(provider, provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists monetization_payment_attempts_provider_prepare_key
  on public.monetization_payment_attempts(provider, provider_prepare_id)
  where provider_prepare_id is not null;

create sequence if not exists public.monetization_click_prepare_seq
  minvalue 100000
  maxvalue 2147483647
  start 100000
  increment 1
  cycle;

revoke all on sequence public.monetization_click_prepare_seq from public, anon, authenticated;
grant usage, select on sequence public.monetization_click_prepare_seq to service_role;

commit;
