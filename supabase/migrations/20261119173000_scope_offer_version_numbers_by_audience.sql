-- Offer versions are numbered independently for public and partner audiences.
alter table public.offer_versions
  drop constraint if exists offer_versions_version_key;

create unique index if not exists offer_versions_audience_version_idx
  on public.offer_versions(audience, version);
