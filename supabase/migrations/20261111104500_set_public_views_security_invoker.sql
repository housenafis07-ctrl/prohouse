-- Ensure public read views respect the querying user's underlying-table RLS.
-- Both views intentionally expose public inventory only; security_invoker makes
-- their access checks use the caller's privileges and RLS policies rather
-- than the view owner's privileges.

begin;

alter view public.listing_search set (security_invoker = true);
alter view public.new_building_inventory set (security_invoker = true);

commit;
