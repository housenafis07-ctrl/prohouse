-- P1: verification RPCs must not be callable anonymously.
-- request_trusted_profile is the authenticated user's own request flow.
-- sync_profile_payment_verification is trigger-only and must never be client callable.

revoke all on function public.request_trusted_profile() from public, anon;
grant execute on function public.request_trusted_profile() to authenticated;

revoke all on function public.sync_profile_payment_verification() from public, anon, authenticated;
