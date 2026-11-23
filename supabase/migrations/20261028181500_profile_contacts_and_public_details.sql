begin;

alter table public.profiles
  add column if not exists email text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists linkedin_url text,
  add column if not exists telegram_url text;

comment on column public.profiles.email is 'Public/contact email shown in the user profile when provided.';
comment on column public.profiles.instagram_url is 'Public Instagram profile URL.';
comment on column public.profiles.facebook_url is 'Public Facebook profile URL.';
comment on column public.profiles.linkedin_url is 'Public LinkedIn profile URL.';
comment on column public.profiles.telegram_url is 'Public Telegram profile URL, separate from the authenticated Telegram bot link.';

commit;
