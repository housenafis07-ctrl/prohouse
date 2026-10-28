begin;

-- RoyalHouse accounts must be phone-registered. Remove only accounts whose
-- Supabase auth identity was created by the legacy Telegram flow.
-- Existing phone-registered accounts that merely have Telegram linked are kept.
delete from auth.users
where raw_user_meta_data->>'auth_provider' = 'telegram';

commit;
