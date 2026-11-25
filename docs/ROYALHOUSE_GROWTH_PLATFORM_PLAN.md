# RoyalHouse Growth Platform — implementation plan

This branch is isolated from `main`. No Production database changes are part of this work.

## Audit baseline
- Existing saved-search alerts run in the browser using localStorage snapshots and a 10-minute interval. The server-side delivery path is not yet implemented.
- Existing listing comparison supports up to three listings.
- Listing interaction events and owner listing statistics already exist.
- Listing quality scoring already exists for the listing authoring flow; this is not the same as lead quality scoring.
- Developer lead pipeline, statuses, notes, activity history, and response-time reporting already exist.
- Developer profiles, complexes, inventory, and lead requests already exist.
- Partner verification documents and trust verification records already exist.
- Telegram campaign delivery and web-push subscriptions already exist.
- Agency profiles and agency_agents tables exist; team workspace UX and permission boundaries require further audit before extending them.

## Workstreams

### 1. Retention and conversion
1. Upgrade saved-search alerts from browser-only polling to server-triggered processing; the cron endpoint sends browser push and queues Telegram messages for users with a verified bot link.
2. Reuse existing `saved_searches`, `notifications`, `push_subscriptions`, and push delivery infrastructure.
3. Add a universal appointment request flow for sale/rent listings. Keep vacation rental booking rules separate.
4. Add shareable family shortlists with explicit access controls; do not expose private saved searches or user account data.

Acceptance: idempotent alert delivery, ownership-safe reads/writes, no duplicate notification per matching listing/search, retryable push/Telegram delivery, appointment status lifecycle and owner notifications, private-by-default shortlist access. The new cron endpoint still needs an approved scheduler cadence (target: every 10 minutes); do not assume Vercel Hobby supports that frequency.

### 2. Market intelligence
1. Build a market metrics data contract using published/active listings and clearly label asking-price data.
2. Add district/property-type/currency/period filters and median price per m² with minimum sample thresholds.
3. Derive demand heatmap from aggregated searches, saves and lead events; anonymize and suppress low-volume cells.
4. Add smart pricing recommendations only where enough comparable active listings exist; explain sample size and range.

Acceptance: no claim that asking prices are completed transaction prices; no personal identifiers in aggregate output; sparse cohorts return “insufficient data”.

### 3. Trust and listing quality
1. Duplicate detection as a review signal, not automatic rejection. Use normalized location/attributes and image similarity only where reliable.
2. Property Passport as an evidence-backed property profile; distinguish owner-provided facts, platform-verified facts, and externally verified records.
3. Preserve current trust verification and moderation workflows; no legal ownership claim without an authorized registry integration.

Acceptance: human review for duplicate candidates, audit trail for decisions, provenance and verification timestamps for every passport field.

### 4. Seller and partner growth
1. Marketing Studio generates editable share assets from listing data; never auto-publish to social platforms without explicit account authorization.
2. Agency Team Workspace builds on existing agency_profiles and agency_agents, with server-side role checks and scoped access.
3. Lead Quality Score is separate from listing quality score. Start with explainable rules based on lead status, viewing intent, contact completeness and response history; avoid opaque AI scoring.

Acceptance: agency tenant isolation, auditable team actions, explainable lead score breakdown, no exposure of private customer data.

## Delivery order
- Slice A: schema/API design and tests for server-side Smart Alert.
- Slice B: appointment requests and family shortlist access model.
- Slice C: market metrics and demand aggregation.
- Slice D: duplicate candidate review and Property Passport provenance.
- Slice E: Marketing Studio, agency workspace permissions, and lead scoring.

## Safety and release gates
- Do not apply migrations to Production from this branch.
- Review existing schema, RLS policies, indexes, cron configuration and push delivery before writing migrations.
- Add migration files only after schema design and local/Preview verification.
- CI, build, security review, and Preview acceptance are required before any merge request can be considered ready.
- This work is not authorized to merge or deploy Production.
