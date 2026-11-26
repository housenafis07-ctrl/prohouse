-- Keep the existing registration flow intact while restoring the partner-side
-- profile that downstream listing permissions expect.
-- Trusted-profile verification remains optional: this only creates the basic
-- partner profile with pending verification status when the account is a partner.

create or replace function public.ensure_partner_profile_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_type = 'partner' then
    insert into public.partner_profiles (
      user_id,
      partner_type,
      legal_form,
      display_name,
      company_name,
      verification_status,
      metadata,
      updated_at
    )
    values (
      new.id,
      'service_provider',
      case
        when new.partner_type in ('individual','self_employed','sole_proprietor','llc','jsc','other')
          then new.partner_type
        else null
      end,
      coalesce(nullif(trim(new.company_name), ''), nullif(trim(new.full_name), ''), 'Hamkor'),
      nullif(trim(new.company_name), ''),
      'pending',
      jsonb_build_object(
        'inn', nullif(trim(coalesce(new.inn, '')), ''),
        'bank_name', nullif(trim(coalesce(new.bank_name, '')), ''),
        'bank_account', nullif(trim(coalesce(new.bank_account, '')), ''),
        'mfo', nullif(trim(coalesce(new.mfo, '')), ''),
        'oked', nullif(trim(coalesce(new.oked, '')), ''),
        'director_full_name', nullif(trim(coalesce(new.director_full_name, '')), '')
      ),
      now()
    )
    on conflict (user_id) do update set
      legal_form = excluded.legal_form,
      display_name = excluded.display_name,
      company_name = excluded.company_name,
      metadata = excluded.metadata,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_ensure_partner_profile on public.profiles;
create trigger profiles_ensure_partner_profile
after insert or update of account_type, partner_type, full_name, company_name, inn, bank_name, bank_account, mfo, oked, director_full_name
on public.profiles
for each row
execute function public.ensure_partner_profile_from_profile();

-- Repair partner accounts that were registered before this trigger existed.
insert into public.partner_profiles (
  user_id,
  partner_type,
  legal_form,
  display_name,
  company_name,
  verification_status,
  metadata,
  updated_at
)
select
  p.id,
  'service_provider',
  case
    when p.partner_type in ('individual','self_employed','sole_proprietor','llc','jsc','other')
      then p.partner_type
    else null
  end,
  coalesce(nullif(trim(p.company_name), ''), nullif(trim(p.full_name), ''), 'Hamkor'),
  nullif(trim(p.company_name), ''),
  'pending',
  jsonb_build_object(
    'inn', nullif(trim(coalesce(p.inn, '')), ''),
    'bank_name', nullif(trim(coalesce(p.bank_name, '')), ''),
    'bank_account', nullif(trim(coalesce(p.bank_account, '')), ''),
    'mfo', nullif(trim(coalesce(p.mfo, '')), ''),
    'oked', nullif(trim(coalesce(p.oked, '')), ''),
    'director_full_name', nullif(trim(coalesce(p.director_full_name, '')), '')
  ),
  now()
from public.profiles p
where p.account_type = 'partner'
on conflict (user_id) do nothing;
