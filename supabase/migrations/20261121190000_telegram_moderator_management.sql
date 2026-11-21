begin;

-- Backward-compatible repair for installations where the historical table
-- was created with admin_id instead of admin_user_id.
alter table public.listing_moderation_history
  add column if not exists admin_user_id uuid references auth.users(id) on delete set null;
alter table public.listing_moderation_history
  add column if not exists moderator_telegram_id text;
alter table public.listing_moderation_history
  add column if not exists action text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listing_moderation_history'
      and column_name = 'admin_id'
  ) then
    execute 'update public.listing_moderation_history set admin_user_id = admin_id where admin_user_id is null';
  end if;
end $$;

create index if not exists listing_moderation_history_admin_user_idx
  on public.listing_moderation_history(admin_user_id, created_at desc);

create index if not exists listing_moderation_history_telegram_moderator_idx
  on public.listing_moderation_history(moderator_telegram_id, created_at desc)
  where moderator_telegram_id is not null;

create table if not exists public.telegram_moderators (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text not null unique,
  chat_id text not null,
  username text,
  first_name text,
  is_active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint telegram_moderators_user_id_numeric check (telegram_user_id ~ '^[0-9]+$')
);

create table if not exists public.telegram_moderator_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_telegram_id text,
  created_at timestamptz not null default now()
);

create index if not exists telegram_moderators_active_idx
  on public.telegram_moderators(is_active, created_at desc);
create index if not exists telegram_moderator_invites_expiry_idx
  on public.telegram_moderator_invites(expires_at)
  where used_at is null;

alter table public.telegram_moderators enable row level security;
alter table public.telegram_moderator_invites enable row level security;

revoke all on public.telegram_moderators from anon, authenticated;
revoke all on public.telegram_moderator_invites from anon, authenticated;
grant all on public.telegram_moderators to service_role;
grant all on public.telegram_moderator_invites to service_role;


-- Make the listing state transition and its audit record one atomic operation.
create or replace function public.moderate_listing_with_audit(
  p_listing_id uuid,
  p_action text,
  p_reason text,
  p_telegram_user_id text
)
returns table(id uuid, listing_code text, status text, moderation_note text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_next_status text;
  v_listing public.listings%rowtype;
begin
  if p_action not in ('approve', 'reject') then
    raise exception 'INVALID_MODERATION_ACTION';
  end if;
  if p_action = 'reject' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'REJECTION_REASON_REQUIRED';
  end if;
  if coalesce(btrim(p_telegram_user_id), '') !~ '^[0-9]+$' then
    raise exception 'INVALID_MODERATOR_TELEGRAM_ID';
  end if;

  v_next_status := case when p_action = 'approve' then 'active' else 'draft' end;

  update public.listings
  set status = v_next_status,
      is_verified = (p_action = 'approve'),
      published_at = case when p_action = 'approve' then now() else null end,
      moderation_note = case when p_action = 'approve' then null else left(btrim(p_reason), 1000) end,
      moderation_updated_at = now(),
      updated_at = now()
  where listings.id = p_listing_id
    and listings.status = 'moderation'
  returning listings.* into v_listing;

  if not found then
    raise exception 'LISTING_ALREADY_MODERATED';
  end if;

  insert into public.listing_moderation_history (
    listing_id, admin_user_id, moderator_telegram_id,
    from_status, to_status, action, reason, created_at
  ) values (
    p_listing_id, null, p_telegram_user_id,
    'moderation', v_next_status, p_action,
    nullif(left(btrim(coalesce(p_reason, '')), 1000), ''), now()
  );

  return query
    select v_listing.id, v_listing.listing_code::text,
           v_listing.status::text, v_listing.moderation_note::text;
end;
$function$;

revoke all on function public.moderate_listing_with_audit(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.moderate_listing_with_audit(uuid, text, text, text) to service_role;

commit;
