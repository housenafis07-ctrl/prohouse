begin;
alter table public.telegram_link_tokens alter column profile_id drop not null;
commit;
