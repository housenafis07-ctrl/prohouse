# Royalhouse Dacha rental model

Royalhouse's `Ijara → Dachalar` flow is based on the useful UX patterns observed on Bronla.uz, but the implementation remains native to Royalhouse's existing listings, taxonomy, moderation and account systems.

## Included in this PR

- Dedicated `rent_dacha` taxonomy filter.
- Dacha-specific listing attributes: guests, bedrooms, beds, guest types, pool, pets, alcohol, marriage-certificate rule, check-in/out, quiet hours, landmark, second phone, amenities and weekday/weekend prices.
- Monthly availability calendar on every active dacha listing.
- Free, booked and owner-blocked dates are visually separated.
- Customer can select free check-in/check-out dates and send a booking request.
- Owner sees booking requests on the same calendar and can confirm/reject them.
- Owner can manually close dates that are unavailable for any reason.
- Overlapping pending/confirmed bookings are blocked at database level.
- Dacha platform commission is fixed at 15% in the booking record and is shown to customers/owners as a separate commercial term. Payment gateway settlement is intentionally not hard-coded into this PR.
- Telegram webhook entrypoint with buttons to the Royalhouse personal cabinet, listing creation, dacha catalog and general listings.

## Bronla-derived requirements used

Bronla's public dacha listing guidance emphasizes accurate owner/manager information, current photos, truthful amenities, a maintained availability calendar, updated prices, temporarily disabling unavailable properties, and readiness/cleanliness before guest arrival. It also collects guest capacity, bedrooms/beds, location/landmark, map position, guest rules, pool, amenities, check-in/out, phone numbers and daily/weekly pricing.

Royalhouse maps these concepts to `category_attributes`, the existing listing wizard and the new booking/calendar layer instead of creating a second listing system.

## Telegram activation

Set these Vercel/server environment variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET` (recommended)
- `NEXT_PUBLIC_SITE_URL=https://royalhouse.uz`

Then register the webhook with Telegram's `setWebhook` API using:

`https://royalhouse.uz/api/telegram/webhook`

The bot opens the same Royalhouse account and listing flows as the website, so users are not trapped inside a separate bot-only product.
