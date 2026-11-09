begin;

-- Atomic OTP reservation: serializes concurrent sends for the same phone.
create or replace function public.reserve_sms_otp(
  p_phone text,
  p_code_hash text,
  p_expires_at timestamptz,
  p_cooldown_seconds integer default 60
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_phone !~ '^\+998[0-9]{9}$' or p_code_hash is null or p_expires_at <= now() then
    raise exception 'INVALID_OTP_REQUEST';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_phone, 0));

  if exists (
    select 1 from public.sms_otp_codes
    where phone = p_phone
      and used_at is null
      and created_at >= now() - make_interval(secs => greatest(p_cooldown_seconds, 1))
  ) then
    raise exception 'OTP_RESEND_COOLDOWN';
  end if;

  insert into public.sms_otp_codes(phone, code_hash, expires_at)
  values (p_phone, p_code_hash, p_expires_at)
  returning id into v_id;

  return v_id;
end;
$$;

-- Atomically check attempts and consume a code exactly once.
create or replace function public.consume_sms_otp(
  p_phone text,
  p_code_hash text,
  p_max_attempts integer default 5
)
returns table(status text, otp_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otp public.sms_otp_codes%rowtype;
begin
  select * into v_otp
  from public.sms_otp_codes
  where phone = p_phone and used_at is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid;
    return;
  end if;

  if v_otp.expires_at <= now() then
    return query select 'EXPIRED'::text, v_otp.id;
    return;
  end if;

  if v_otp.attempts >= p_max_attempts then
    return query select 'LOCKED'::text, v_otp.id;
    return;
  end if;

  if v_otp.code_hash <> p_code_hash then
    update public.sms_otp_codes
      set attempts = attempts + 1
      where id = v_otp.id;
    return query select case when v_otp.attempts + 1 >= p_max_attempts then 'LOCKED' else 'INVALID' end, v_otp.id;
    return;
  end if;

  update public.sms_otp_codes
    set used_at = now()
    where id = v_otp.id and used_at is null;

  return query select 'VERIFIED'::text, v_otp.id;
end;
$$;

revoke all on function public.reserve_sms_otp(text,text,timestamptz,integer) from public, anon, authenticated;
revoke all on function public.consume_sms_otp(text,text,integer) from public, anon, authenticated;
grant execute on function public.reserve_sms_otp(text,text,timestamptz,integer) to service_role;
grant execute on function public.consume_sms_otp(text,text,integer) to service_role;

-- Telegram's own request_contact button verifies that the shared contact
-- belongs to the sending Telegram account. Keep that proof distinct from SMS.
alter table public.phone_verification_claims
  drop constraint if exists phone_verification_claims_verification_method_check;
alter table public.phone_verification_claims
  add constraint phone_verification_claims_verification_method_check
  check (verification_method in ('sms_otp', 'telegram_contact'));

commit;
 or p_code_hash is null or p_expires_at <= now() then
    raise exception 'INVALID_OTP_REQUEST';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_phone, 0));

  if exists (
    select 1 from public.sms_otp_codes
    where phone = p_phone
      and used_at is null
      and created_at >= now() - make_interval(secs => greatest(p_cooldown_seconds, 1))
  ) then
    raise exception 'OTP_RESEND_COOLDOWN';
  end if;

  insert into public.sms_otp_codes(phone, code_hash, expires_at)
  values (p_phone, p_code_hash, p_expires_at)
  returning id into v_id;

  return v_id;
end;
$$;

-- Atomically check attempts and consume a code exactly once.
create or replace function public.consume_sms_otp(
  p_phone text,
  p_code_hash text,
  p_max_attempts integer default 5
)
returns table(status text, otp_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otp public.sms_otp_codes%rowtype;
begin
  select * into v_otp
  from public.sms_otp_codes
  where phone = p_phone and used_at is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid;
    return;
  end if;

  if v_otp.expires_at <= now() then
    return query select 'EXPIRED'::text, v_otp.id;
    return;
  end if;

  if v_otp.attempts >= p_max_attempts then
    return query select 'LOCKED'::text, v_otp.id;
    return;
  end if;

  if v_otp.code_hash <> p_code_hash then
    update public.sms_otp_codes
      set attempts = attempts + 1
      where id = v_otp.id;
    return query select case when v_otp.attempts + 1 >= p_max_attempts then 'LOCKED' else 'INVALID' end, v_otp.id;
    return;
  end if;

  update public.sms_otp_codes
    set used_at = now()
    where id = v_otp.id and used_at is null;

  return query select 'VERIFIED'::text, v_otp.id;
end;
$$;

revoke all on function public.reserve_sms_otp(text,text,timestamptz,integer) from public, anon, authenticated;
revoke all on function public.consume_sms_otp(text,text,integer) from public, anon, authenticated;
grant execute on function public.reserve_sms_otp(text,text,timestamptz,integer) to service_role;
grant execute on function public.consume_sms_otp(text,text,integer) to service_role;

-- Telegram's own request_contact button verifies that the shared contact
-- belongs to the sending Telegram account. Keep that proof distinct from SMS.
alter table public.phone_verification_claims
  drop constraint if exists phone_verification_claims_verification_method_check;
alter table public.phone_verification_claims
  add constraint phone_verification_claims_verification_method_check
  check (verification_method in ('sms_otp', 'telegram_contact'));

commit;
