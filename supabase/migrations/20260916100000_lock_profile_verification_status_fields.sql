-- P0 #3: users may edit profile/business data, but never server-controlled verification/trust state.
-- trusted_profile_opt_in remains user-editable because it represents user consent/request intent.

revoke all privileges on table public.profiles from public;
revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;
grant insert (
  id, phone, full_name, account_type, partner_type, company_name,
  inn, bank_name, bank_account, mfo, oked, director_full_name
) on table public.profiles to authenticated;
grant update (
  phone, full_name, account_type, partner_type, company_name,
  inn, bank_name, bank_account, mfo, oked, director_full_name,
  trusted_profile_opt_in
) on table public.profiles to authenticated;
grant delete on table public.profiles to authenticated;

-- Partner profiles remain publicly readable according to RLS;
-- authenticated owners can write business-facing fields only.
grant select on table public.partner_profiles to public;
revoke insert, update, delete on table public.partner_profiles from public;
revoke insert, update, delete on table public.partner_profiles from anon;
revoke insert, update, delete on table public.partner_profiles from authenticated;

grant insert (
  user_id, partner_type, legal_form, display_name, company_name,
  description, logo_url, website, service_regions, metadata
) on table public.partner_profiles to authenticated;
grant update (
  partner_type, legal_form, display_name, company_name,
  description, logo_url, website, service_regions, metadata
) on table public.partner_profiles to authenticated;
grant delete on table public.partner_profiles to authenticated;
