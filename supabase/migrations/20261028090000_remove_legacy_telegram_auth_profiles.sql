begin;

-- RoyalHouse accounts must be phone-registered. Remove legacy Telegram-only
-- accounts and the listings created by those accounts. Phone-registered
-- accounts that merely use Telegram for notifications/linking are preserved.
delete from public.listings
where owner_id in (
  select id
  from auth.users
  where raw_user_meta_data->>'auth_provider' = 'telegram'
);

delete from auth.users
where raw_user_meta_data->>'auth_provider' = 'telegram';

commit;
