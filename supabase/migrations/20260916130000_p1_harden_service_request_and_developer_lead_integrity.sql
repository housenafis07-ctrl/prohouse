-- P1 IDOR/integrity hardening: bind foreign references to resources the caller can legitimately reference.

create or replace function public.enforce_service_request_listing_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_owner uuid;
begin
  if new.listing_id is null then return new; end if;
  select status, owner_id into v_status, v_owner
  from public.listings
  where id = new.listing_id;

  if not found then
    raise exception 'LISTING_NOT_FOUND' using errcode = '23503';
  end if;

  if v_status <> 'active' and v_owner <> new.user_id then
    raise exception 'LISTING_NOT_ACCESSIBLE' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_service_request_listing_access on public.service_requests;
create trigger trg_enforce_service_request_listing_access
before insert on public.service_requests
for each row execute function public.enforce_service_request_listing_access();

create or replace function public.enforce_developer_lead_reference_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_complex_developer uuid;
  v_unit_complex uuid;
begin
  if new.complex_id is not null then
    select developer_id into v_complex_developer
    from public.residential_complexes
    where id = new.complex_id;

    if not found then
      raise exception 'COMPLEX_NOT_FOUND' using errcode = '23503';
    end if;

    if v_complex_developer <> new.developer_id then
      raise exception 'DEVELOPER_COMPLEX_MISMATCH' using errcode = '23514';
    end if;
  end if;

  if new.unit_id is not null then
    select complex_id into v_unit_complex
    from public.complex_units
    where id = new.unit_id;

    if not found then
      raise exception 'UNIT_NOT_FOUND' using errcode = '23503';
    end if;

    if new.complex_id is null or v_unit_complex <> new.complex_id then
      raise exception 'UNIT_COMPLEX_MISMATCH' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_developer_lead_reference_integrity on public.developer_lead_requests;
create trigger trg_enforce_developer_lead_reference_integrity
before insert on public.developer_lead_requests
for each row execute function public.enforce_developer_lead_reference_integrity();
