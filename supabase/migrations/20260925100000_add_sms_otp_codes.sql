create table if not exists public.sms_otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sms_otp_codes_phone_created_idx
  on public.sms_otp_codes(phone, created_at desc);

alter table public.sms_otp_codes enable row level security;

-- OTP records are server-only. No direct client access.
revoke all on public.sms_otp_codes from anon, authenticated;
