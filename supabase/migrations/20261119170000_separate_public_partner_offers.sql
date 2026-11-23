-- Separate public user terms from professional partner terms.
alter table public.offer_versions
  add column if not exists audience text not null default 'public';

alter table public.offer_versions
  drop constraint if exists offer_versions_audience_check;

alter table public.offer_versions
  add constraint offer_versions_audience_check
  check (audience in ('public', 'partner'));

drop index if exists public.offer_versions_active_idx;
create unique index if not exists offer_versions_active_audience_idx
  on public.offer_versions (audience)
  where is_active = true;

alter table public.offer_consents
  add column if not exists audience text not null default 'public';

alter table public.offer_consents
  drop constraint if exists offer_consents_audience_check;

alter table public.offer_consents
  add constraint offer_consents_audience_check
  check (audience in ('public', 'partner'));

create index if not exists offer_consents_user_audience_idx
  on public.offer_consents(user_id, audience, offer_version);
