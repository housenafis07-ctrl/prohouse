begin;

create schema if not exists passkey_stage;

revoke all on schema passkey_stage from public, anon, authenticated;
grant usage on schema passkey_stage to service_role;

create table if not exists passkey_stage.passkey_credentials (
  credential_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_type text not null default 'singleDevice',
  backed_up boolean not null default false,
  friendly_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists passkey_credentials_user_id_idx
  on passkey_stage.passkey_credentials(user_id);

create table if not exists passkey_stage.passkey_challenges (
  challenge text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  phone text,
  purpose text not null check (purpose in ('registration', 'authentication')),
  expected_origin text not null,
  expected_rp_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint passkey_challenge_identity_check check (
    (purpose = 'registration' and user_id is not null and phone is null)
    or (purpose = 'authentication' and user_id is not null and phone is not null)
  )
);

create index if not exists passkey_challenges_expiry_idx
  on passkey_stage.passkey_challenges(expires_at);

alter table passkey_stage.passkey_credentials enable row level security;
alter table passkey_stage.passkey_challenges enable row level security;

revoke all on passkey_stage.passkey_credentials from public, anon, authenticated;
revoke all on passkey_stage.passkey_challenges from public, anon, authenticated;
grant all on passkey_stage.passkey_credentials to service_role;
grant all on passkey_stage.passkey_challenges to service_role;

commit;
