-- Restore the self-service RLS policies required by registration.
-- The profiles and offer_consents tables have RLS enabled; without these policies,
-- authenticated users can receive 42501 even when column grants are present.

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
  on public.profiles for delete to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Authenticated users can record own offer consent" on public.offer_consents;
create policy "Authenticated users can record own offer consent"
  on public.offer_consents for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can read own offer consents" on public.offer_consents;
create policy "Users can read own offer consents"
  on public.offer_consents for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Anyone can read active offer" on public.offer_versions;
create policy "Anyone can read active offer"
  on public.offer_versions for select
  using (is_active = true);
