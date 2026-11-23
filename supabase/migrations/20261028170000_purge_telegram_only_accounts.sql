begin;

-- Telegram is no longer an authentication method. Remove every legacy
-- Telegram-only auth identity, including older identities whose metadata may
-- no longer contain auth_provider='telegram' but which still have no phone
-- number and are registered in the Telegram identity table.
with telegram_only_users as (
  select distinct u.id
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.raw_user_meta_data->>'auth_provider' = 'telegram'
     or (
       p.phone is null
       and exists (
         select 1
         from public.telegram_user_links tul
         where tul.profile_id = u.id
       )
     )
)
delete from auth.users u
using telegram_only_users t
where u.id = t.id;

commit;
