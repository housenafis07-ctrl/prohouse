-- Private intake queue for Telegram AI listing imports.
-- Imported third-party content must never enter public listings before authority is verified.
create table if not exists public.telegram_listing_imports (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text not null,
  source_chat_id text not null,
  source_message_id bigint not null,
  media_group_id text,
  source_message_ids bigint[] not null default '{}'::bigint[],
  submitter_profile_id uuid references public.profiles(id) on delete set null,
  source_forward_origin jsonb not null default '{}'::jsonb,
  source_text text not null default '',
  source_media jsonb not null default '[]'::jsonb,
  ai_extracted jsonb not null default '{}'::jsonb,
  status text not null default 'awaiting_authorization'
    check (status in ('processing','awaiting_authorization','awaiting_payment_choice','awaiting_realtor_review','authorized','ready_for_moderation','rejected','failed')),
  authorization_status text not null default 'pending'
    check (authorization_status in ('pending','verified','rejected')),
  authorization_method text
    check (authorization_method is null or authorization_method in ('owner_sms_otp','owner_consent_link','power_of_attorney_review','admin_review')),
  owner_full_name text,
  owner_phone text,
  authorization_document_path text,
  authorized_at timestamptz,
  authorized_by uuid references public.profiles(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (telegram_user_id, source_chat_id, source_message_id)
);

create index if not exists telegram_listing_imports_submitter_created_idx
  on public.telegram_listing_imports (submitter_profile_id, created_at desc);
create index if not exists telegram_listing_imports_status_created_idx
  on public.telegram_listing_imports (status, created_at desc);
create unique index if not exists telegram_listing_imports_media_group_uidx
  on public.telegram_listing_imports (telegram_user_id, source_chat_id, media_group_id)
  where media_group_id is not null;

alter table public.telegram_listing_imports enable row level security;
revoke all on table public.telegram_listing_imports from public, anon, authenticated;
grant all on table public.telegram_listing_imports to service_role;

comment on table public.telegram_listing_imports is
  'Private staging queue for AI-parsed Telegram listings. Never public; requires verified owner/representative authority before conversion into listings.';

-- Original media is retained in a private bucket for the later authorization and moderation workflow.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('telegram-listing-imports', 'telegram-listing-imports', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp'];


-- One-time, expiring owner-consent links. Only the hash is persisted.
create table if not exists public.telegram_listing_import_consents (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.telegram_listing_imports(id) on delete cascade,
  token_hash text not null unique,
  owner_phone text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists telegram_listing_import_consents_import_idx
  on public.telegram_listing_import_consents(import_id, created_at desc);
alter table public.telegram_listing_import_consents enable row level security;
revoke all on table public.telegram_listing_import_consents from public, anon, authenticated;
grant all on table public.telegram_listing_import_consents to service_role;

-- The same private bucket also stores authorization evidence (PDF/JPEG/PNG).
update storage.buckets
set public = false,
    file_size_limit = 12582912,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
where id = 'telegram-listing-imports';


-- Atomically consume the one-time owner consent and verify the authenticated phone.
create or replace function public.consume_telegram_listing_import_consent(
  p_token_hash text,
  p_user_id uuid
)
returns table(status text, import_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent public.telegram_listing_import_consents%rowtype;
  v_import public.telegram_listing_imports%rowtype;
  v_profile_phone text;
  v_owner_phone text;
begin
  select * into v_consent
  from public.telegram_listing_import_consents
  where token_hash = p_token_hash
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid; return;
  end if;
  if v_consent.consumed_at is not null then
    return query select 'ALREADY_USED'::text, v_consent.import_id; return;
  end if;
  if v_consent.expires_at <= now() then
    return query select 'EXPIRED'::text, v_consent.import_id; return;
  end if;

  select phone into v_profile_phone from public.profiles where id = p_user_id;
  v_profile_phone := regexp_replace(coalesce(v_profile_phone, ''), '\D', '', 'g');
  v_owner_phone := regexp_replace(coalesce(v_consent.owner_phone, ''), '\D', '', 'g');
  if v_profile_phone = '' or v_profile_phone <> v_owner_phone then
    return query select 'PHONE_MISMATCH'::text, v_consent.import_id; return;
  end if;

  select * into v_import from public.telegram_listing_imports
  where id = v_consent.import_id
  for update;
  if not found or v_import.authorization_status <> 'pending'
     or regexp_replace(coalesce(v_import.owner_phone, ''), '\D', '', 'g') <> v_owner_phone then
    return query select 'IMPORT_CHANGED'::text, v_consent.import_id; return;
  end if;

  update public.telegram_listing_import_consents set consumed_at = now() where id = v_consent.id;
  update public.telegram_listing_imports
  set authorization_status = 'verified',
      authorization_method = 'owner_sms_otp',
      authorized_at = now(),
      authorized_by = p_user_id,
      status = 'ready_for_moderation',
      updated_at = now()
  where id = v_import.id;

  return query select 'VERIFIED'::text, v_import.id;
end;
$$;

revoke all on function public.consume_telegram_listing_import_consent(text, uuid) from public, anon, authenticated;
grant execute on function public.consume_telegram_listing_import_consent(text, uuid) to service_role;
