begin;

-- Server-only proof that an OTP was successfully verified for a phone number.
-- A fresh SMS verification is required before Telegram can be linked.
create table if not exists public.phone_verification_claims (
  phone text primary key,
  verified_at timestamptz not null default now(),
  verification_method text not null default 'sms_otp'
    check (verification_method = 'sms_otp')
);

alter table public.phone_verification_claims enable row level security;
revoke all on public.phone_verification_claims from public, anon, authenticated;
grant all on public.phone_verification_claims to service_role;

create or replace function public.link_telegram_identity(
  p_profile_id uuid,
  p_telegram_user_id text,
  p_chat_id text,
  p_telegram_username text,
  p_linked_at timestamptz
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_phone text;
  v_existing_profile uuid;
  v_existing_auth_user uuid;
  v_existing_telegram_id text;
  v_rows integer;
begin
  if p_telegram_user_id is null or p_telegram_user_id = ''
     or p_chat_id is null or p_chat_id = '' then
    raise exception 'INVALID_TELEGRAM_ID';
  end if;

  select phone into v_phone
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_phone is null or btrim(v_phone) = '' or not exists (
    select 1 from public.phone_verification_claims
    where phone = v_phone
      and verified_at >= now() - interval '30 days'
  ) then
    raise exception 'PHONE_VERIFICATION_REQUIRED';
  end if;

  select profile_id into v_existing_profile
  from public.telegram_user_links
  where telegram_user_id = p_telegram_user_id;
  if v_existing_profile is not null and v_existing_profile <> p_profile_id then
    raise exception 'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE';
  end if;

  select telegram_user_id into v_existing_telegram_id
  from public.telegram_user_links
  where profile_id = p_profile_id;
  if v_existing_telegram_id is not null and v_existing_telegram_id <> p_telegram_user_id then
    raise exception 'PROFILE_ALREADY_LINKED_TO_ANOTHER_TELEGRAM';
  end if;

  select profile_id, auth_user_id
    into v_existing_profile, v_existing_auth_user
  from public.telegram_bot_users
  where telegram_user_id = p_telegram_user_id;
  if (v_existing_profile is not null and v_existing_profile <> p_profile_id)
     or (v_existing_auth_user is not null and v_existing_auth_user <> p_profile_id) then
    raise exception 'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE';
  end if;

  select telegram_user_id into v_existing_telegram_id
  from public.telegram_bot_users
  where auth_user_id = p_profile_id;
  if v_existing_telegram_id is not null and v_existing_telegram_id <> p_telegram_user_id then
    raise exception 'PROFILE_ALREADY_LINKED_TO_ANOTHER_TELEGRAM';
  end if;

  insert into public.telegram_user_links (
    profile_id, telegram_user_id, chat_id, telegram_username,
    linked_at, verified_at, verification_method
  ) values (
    p_profile_id, p_telegram_user_id, p_chat_id, p_telegram_username,
    p_linked_at, p_linked_at, 'telegram_mini_app_auto_link'
  )
  on conflict (profile_id) do update
    set telegram_username = excluded.telegram_username,
        linked_at = excluded.linked_at,
        verified_at = excluded.verified_at,
        verification_method = excluded.verification_method
    where public.telegram_user_links.telegram_user_id = excluded.telegram_user_id;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'PROFILE_ALREADY_LINKED_TO_ANOTHER_TELEGRAM';
  end if;

  insert into public.telegram_bot_users (
    telegram_user_id, chat_id, profile_id, auth_user_id, username,
    is_active, blocked_at, last_interaction_at, updated_at
  ) values (
    p_telegram_user_id, p_chat_id, p_profile_id, p_profile_id, p_telegram_username,
    true, null, p_linked_at, p_linked_at
  )
  on conflict (telegram_user_id) do update
    set profile_id = excluded.profile_id,
        auth_user_id = excluded.auth_user_id,
        username = excluded.username,
        is_active = true,
        blocked_at = null,
        last_interaction_at = excluded.last_interaction_at,
        updated_at = excluded.updated_at
    where (public.telegram_bot_users.profile_id is null
           or public.telegram_bot_users.profile_id = excluded.profile_id)
      and (public.telegram_bot_users.auth_user_id is null
           or public.telegram_bot_users.auth_user_id = excluded.auth_user_id);

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE';
  end if;
end;
$$;

revoke all on function public.link_telegram_identity(uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.link_telegram_identity(uuid, text, text, text, timestamptz) to service_role;

commit;
