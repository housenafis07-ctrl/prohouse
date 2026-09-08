# Listing ownership field

For individual users creating a house listing, the listing wizard should expose a `Mulk egasi` field with these values:

- `owner` — Egasiman
- `power_of_attorney` — Ishonchnoma asosida
- `representative` — Vakilman

Persist the selected value to `listings.ownership_type`. The field is separate from `account_type` and from mortgage eligibility.

This marker documents the P1 listing contract until the wizard form component is refactored in the next UI commit.