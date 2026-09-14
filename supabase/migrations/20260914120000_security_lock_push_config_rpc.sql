-- P0 security hardening
-- get_push_config() returns the VAPID private key and must never be callable
-- by anon/authenticated clients. It is used only by server-side code through
-- the service-role Supabase client.

revoke execute on function public.get_push_config() from public;
revoke execute on function public.get_push_config() from anon;
revoke execute on function public.get_push_config() from authenticated;
grant execute on function public.get_push_config() to service_role;
