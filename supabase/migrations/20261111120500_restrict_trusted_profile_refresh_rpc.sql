begin;

-- This routine recalculates trust from verified MyID and payment-account
-- evidence and updates every listing owned by the supplied profile. It is an
-- internal server/trigger operation, not a client-callable RPC.
revoke all on function public.refresh_trusted_profile(uuid) from public;
revoke all on function public.refresh_trusted_profile(uuid) from anon;
revoke all on function public.refresh_trusted_profile(uuid) from authenticated;
grant execute on function public.refresh_trusted_profile(uuid) to service_role;

commit;
