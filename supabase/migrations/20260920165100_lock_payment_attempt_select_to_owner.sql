begin;

alter table public.monetization_payment_attempts enable row level security;

drop policy if exists "Users can view own payment attempts" on public.monetization_payment_attempts;
create policy "Users can view own payment attempts"
on public.monetization_payment_attempts
for select
to authenticated
using (
  exists (
    select 1
    from public.monetization_orders o
    where o.id = monetization_payment_attempts.order_id
      and o.user_id = auth.uid()
  )
);

commit;
