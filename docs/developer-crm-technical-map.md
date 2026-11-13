# RoyalHouse Developer CRM — technical audit and implementation map

Audit date: 2026-11-13  
Repository: `housenafis07-ctrl/prohouse`  
Supabase project: `prohouse` (`xuguacjgfvpufeqjxcyb`)  
Production schema was inspected read-only. No production DDL or data was changed during the audit.

## 1. Existing foundation

The Supabase project has 73 tables in `public`. The developer-related foundation already exists:

| Existing table | Current purpose | Current rows | Decision |
|---|---|---:|---|
| `developer_profiles` | Developer identity linked to partner profile | 1 | Reuse |
| `partner_profiles` | Partner/company identity | 2 | Reuse |
| `residential_complexes` | Residential projects, location, moderation and map data | 1 | Reuse |
| `residential_buildings` | Buildings/blocks and technical details | 2 | Reuse |
| `complex_units` | Apartment inventory, prices, floor, status and plan | 9 | Reuse and extend only if required |
| `developer_lead_requests` | Public project/unit enquiry intake; current CRM UI reads this table | 0 | Canonical CRM lead source |
| `developer_leads` | Second lead-shaped model with assignment and notes fields | 0 | Legacy/parallel model; do not add more features here until reconciled |
| `developer_lead_notes` | Internal lead notes | 0 | Reuse |
| `developer_lead_activities` | Calls/messages/meetings activity timeline | 0 | Reuse |
| `developer_complex_documents` | Project documents with moderation and visibility scope | 0 | Reuse |
| `developer_construction_updates` | Construction media and progress updates | 0 | Reuse |
| `admin_developer_page_drafts` | Admin-authored developer page content and handoff | 0 | Separate admin content workflow |

Other related existing structures include `listings`, `listing_leads`, `profiles`, `partner_verification_documents`, `property_transactions`, `rental_bookings`, and the partner/admin RBAC foundation. These should be integrated only where their business semantics match; do not duplicate them.

## 2. Current application behavior

- Main developer cabinet: `app/account/developer/page.tsx`.
- Project workspace: `app/account/developer/complexes/[id]/page.tsx`.
- Inventory: `app/account/developer/inventory/page.tsx`.
- Existing lead API: `app/api/developer/leads/route.ts`.
- Existing lead history API: `app/api/developer/leads/[leadId]/activity/route.ts`.
- Existing lead notes and activity UI: `app/account/developer/LeadActivityPanel.tsx`.
- Existing lead statuses: `new, contacted, qualified, viewing, reserved, won, lost`.
- Existing public lead intake inserts into `developer_lead_requests`; the cabinet GET/PATCH also uses that table.
- The current cabinet is primarily single-owner: access is tied to a verified developer profile and its linked partner user. There is no company employee/membership model in the inspected schema.
- Notes and activity history exist, but there is no task/reminder scheduler or appointment calendar.
- Inventory has unit status and `reservation_expires_at`, but no separate reservation contract/payment ledger for developer sales.
- No dedicated developer CRM sales KPI/analytics model was found in the inspected developer tables.

## 3. Critical schema reconciliation

There are two lead-shaped tables:
- `developer_lead_requests`: public inbound request intake and the active cabinet UI/API source.
- `developer_leads`: currently empty parallel table with customer, assignment and notes fields.

Do not migrate or delete either table as part of the first CRM release. Treat `developer_lead_requests` as canonical for incoming enquiries because the live UI and public API already use it. Plan a later compatibility/backfill decision for `developer_leads` after all code references and historical data have been checked.

## 4. Proposed data model

### Reuse
- `developer_profiles`, `partner_profiles`, `profiles`
- `residential_complexes`, `residential_buildings`, `complex_units`
- `developer_lead_requests`, `developer_lead_notes`, `developer_lead_activities`
- `developer_complex_documents`, `developer_construction_updates`

### Added in this first additive migration
- `developer_team_members`: company-scoped staff membership and role/status.
- `developer_lead_assignments`: assignment audit history; current assignee remains mirrored in `developer_lead_requests.assigned_to`.
- `developer_tasks`: follow-up tasks, reminders and ownership.
- `developer_appointments`: apartment viewings and sales-office appointments.
- Additive lead fields: assignee, priority, next follow-up, lost reason, buyer budget and apartment preferences, update actor and closed timestamp.

### Later phases (not created yet)
- Reservation/deposit/contract lifecycle: first reconcile with `property_transactions` and `complex_units.reservation_expires_at`; do not create an independent payment ledger without a clear mapping.
- Sales commission/agent attribution and external realtor access.
- Marketing campaign/source attribution and campaign ROI.
- Materialized or secured analytics views for conversion, stock, manager performance and revenue.
- AI sales copilot and recommended next action.

## 5. Authorization model

- Every employee membership is scoped to one `developer_profiles.id`.
- `owner` and `admin`: company-wide access and team management.
- `sales_manager`: company lead/task/appointment visibility and assignment authority.
- `sales_agent`: only assigned leads/tasks/appointments, unless explicitly shared.
- `marketing`: campaign/source data; no private lead details unless granted.
- `analyst`: read-only aggregate analytics; no raw customer phone by default.
- The new CRM tables have RLS enabled and direct `anon`/`authenticated` table grants revoked. Access is via server-side routes with explicit membership/role checks. Service-role usage must remain server-side only.
- Never trust client-supplied `developer_id`, `assigned_to`, or role values without verifying membership in the server route.
- Do not rely on `user_metadata` for authorization.

## 6. Security and deployment blockers observed

At audit time, the following security PRs were still open and should be reviewed before enabling multi-user CRM access:
- #488: public inventory views and caller RLS.
- #492: scoped developer admin permissions.
- #493: rate limiting public developer lead submissions.
- #494: private storage for hidden construction media.

Supabase security advisors also reported callable SECURITY DEFINER functions, multiple permissive policies, and leaked-password protection disabled. These are broader project findings; do not blanket-revoke function execution or rewrite policies without per-function behavior review.

## 7. Implementation order

1. **CRM foundation** (this branch): add team membership, lead assignment history, tasks and appointments; extend the canonical lead table additively.
2. **Server authorization/API**: centralized developer membership resolver; owner/admin/manager/agent role checks; team and task endpoints; ensure every query is scoped by developer ID.
3. **CRM UI**: team page, lead assignment/priority/follow-up controls, task list and calendar, employee-specific views.
4. **Inventory and reservations**: integrate unit state with a transactional reservation state machine after reviewing existing property transaction/payment flows.
5. **Analytics**: secured aggregate queries and KPIs, no direct exposure of raw PII.
6. **Marketing and AI**: source attribution, campaign tracking and AI assistant only after reliable events and consent handling exist.

## 8. Non-goals for this migration

- No production data migration or deletion.
- No change to existing public lead intake semantics.
- No change to current listing moderation or admin review workflow.
- No separate Supabase/Vercel project.
- No payment provider integration.
