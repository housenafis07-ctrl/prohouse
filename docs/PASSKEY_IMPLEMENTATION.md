# RoyalHouse Passkey authentication

## Scope

- SMS OTP remains the primary recovery and fallback method.
- Users may add a platform Passkey after a fresh SMS login.
- Passkey login is initiated with the account phone number and verified with WebAuthn.
- Passkey credential material is stored server-side; biometric templates are never sent to RoyalHouse.
- The credential and challenge tables are service-role-only and have RLS enabled.
- Production database migrations are not applied by this PR.

## Deployment and environment

The relying-party ID is derived from the validated request host:
- Production: `royalhouse.uz` (also accepts `www.royalhouse.uz` origin).
- Vercel Preview: the exact `*.vercel.app` deployment hostname.
- Local development: `localhost`.

WebAuthn ceremonies require HTTPS except on localhost. The Preview deployment must use a separate Preview Supabase database/branch. Apply `20261117120000_add_passkey_authentication.sql` to that Preview database only before testing. Do not apply it to Production as part of this PR.

## User flows

1. User completes the existing SMS OTP flow.
2. The account area checks whether a Passkey is already registered.
3. If no Passkey exists and a platform authenticator is available, an optional prompt is displayed.
4. Accepting the prompt invokes the OS/browser Passkey ceremony. User verification is required.
5. The account security page lists registered Passkeys and supports revocation.
6. The login page offers Passkey login beside SMS OTP. SMS OTP remains available.

Adding a Passkey requires an account session issued within the previous 15 minutes. This ensures the user has just completed SMS OTP or another Passkey authentication.

## Preview test matrix

| Device | Browser | Expected |
|---|---|---|
| iPhone with Face ID/Touch ID | Safari | Register, authenticate, revoke |
| Samsung Android | Chrome / Samsung Internet | Fingerprint or device screen lock, authenticate |
| Xiaomi Android | Chrome | Fingerprint or device screen lock, authenticate |
| Desktop | Chrome / Edge / Safari | Passkey prompt only when platform authenticator is available |
| Telegram in-app browser | Android/iOS | Graceful fallback to SMS if WebAuthn is unavailable |

## Security checks

- Challenge is single-use, expires after five minutes, and is bound to user, ceremony, origin, and RP ID.
- Origin and RP ID are validated against the request host.
- User verification is required for registration and authentication.
- Credential ownership is checked against the account user ID.
- Authentication challenge issuance is throttled to ten requests per account per ten minutes.
- Database tables are inaccessible to `anon` and `authenticated`; only `service_role` can access them.
- No merge or Production migration is performed by this PR.
