begin;

-- Security: order creation is authenticated-only. The RPC itself derives
-- user, product price and listing ownership from trusted database state.
revoke all on function public.create_monetization_order(text, uuid, integer, text) from public, anon;
grant execute on function public.create_monetization_order(text, uuid, integer, text) to authenticated;

commit;
