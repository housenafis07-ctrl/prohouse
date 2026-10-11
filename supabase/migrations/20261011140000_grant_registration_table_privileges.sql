-- RLS policies do not grant SQL table privileges by themselves.
-- Explicitly grant the minimum table privileges needed by the registration flow.
grant select, insert, update on table public.profiles to authenticated;
grant select, insert on table public.offer_consents to authenticated;
grant select on table public.offer_versions to anon, authenticated;
