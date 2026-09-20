begin;

-- Security: order items are server-generated from trusted product/order state.
revoke all on table public.monetization_order_items from anon, authenticated;
grant select on table public.monetization_order_items to authenticated;

commit;
