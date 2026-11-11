-- P0 security fix: keep Web Push VAPID private key server-only.
-- The application reads this configuration through get_push_config() using
-- the Supabase service-role client. Browser roles must not read the table or
-- execute the SECURITY DEFINER RPC directly.

begin;

revoke all on table public.push_config from public;
revoke all on table public.push_config from anon;
revoke all on table public.push_config from authenticated;

revoke all on function public.get_push_config() from public;
revoke all on function public.get_push_config() from anon;
revoke all on function public.get_push_config() from authenticated;
grant execute on function public.get_push_config() to service_role;

commit;
