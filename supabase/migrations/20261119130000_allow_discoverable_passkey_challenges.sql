begin;

-- Discoverable Passkey authentication must not require a phone number or
-- pre-resolve the account before the authenticator identifies its credential.
alter table passkey_stage.passkey_challenges
  alter column user_id drop not null;

alter table passkey_stage.passkey_challenges
  drop constraint if exists passkey_challenge_identity_check;

alter table passkey_stage.passkey_challenges
  add constraint passkey_challenge_identity_check check (
    (purpose = 'registration' and user_id is not null and phone is null)
    or (purpose = 'authentication' and (
      (user_id is not null and phone is not null)
      or (user_id is null and phone is null)
    ))
  );

commit;
