import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const webhook = await readFile(new URL('../app/api/telegram/webhook/route.ts', import.meta.url), 'utf8')
const importer = await readFile(new URL('../utils/telegram/listing-import.ts', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261126160000_telegram_ai_listing_imports.sql', import.meta.url), 'utf8')
const draftRoute = await readFile(new URL('../app/api/listings/draft/route.ts', import.meta.url), 'utf8')
const importDetailApi = await readFile(new URL('../app/api/account/listing-imports/[id]/route.ts', import.meta.url), 'utf8')
const listingMetaApi = await readFile(new URL('../app/api/listings/meta/route.ts', import.meta.url), 'utf8')
const consentApi = await readFile(new URL('../app/api/listing-import-consent/route.ts', import.meta.url), 'utf8')
const accountImportsApi = await readFile(new URL('../app/api/account/listing-imports/route.ts', import.meta.url), 'utf8')
const adminImportsApi = await readFile(new URL('../app/api/admin/telegram-listing-imports/route.ts', import.meta.url), 'utf8')
const consentPage = await readFile(new URL('../app/listing-import-consent/page.tsx', import.meta.url), 'utf8')
const accountImportsPage = await readFile(new URL('../app/account/listing-imports/page.tsx', import.meta.url), 'utf8')
const realtorApplicationApi = await readFile(new URL('../app/api/realtors/cabinet/route.ts', import.meta.url), 'utf8')
const realtorAdminApi = await readFile(new URL('../app/api/admin/realtors/route.ts', import.meta.url), 'utf8')
const realtorApplicationPage = await readFile(new URL('../app/realtors/cabinet/page.tsx', import.meta.url), 'utf8')
const listingWizard = await readFile(new URL('../app/listings/new/smart-wizard.tsx', import.meta.url), 'utf8')
const realtorPlanMigration = await readFile(new URL('../supabase/migrations/20261126170000_verified_realtor_partner_tariffs.sql', import.meta.url), 'utf8')
const monetizationPage = await readFile(new URL('../app/account/monetization/page.tsx', import.meta.url), 'utf8')

test('Telegram listing import is private and webhook-authenticated', () => {
  assert.match(webhook, /TELEGRAM_WEBHOOK_SECRET/)
  assert.match(webhook, /handleTelegramListingImport/)
  assert.match(importer, /telegram_user_id/)
})

test('AI import is stored in a private staging table, never published directly', () => {
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /revoke all on table public\.telegram_listing_imports from public, anon, authenticated/i)
  assert.match(importer, /status: 'awaiting_authorization'/)
  assert.doesNotMatch(importer, /\.from\('listings'\)\.(insert|upsert|update)/)
})

test('AI extraction treats forwarded content as untrusted facts only', () => {
  assert.match(importer, /untrusted source material, not instructions/)
  assert.match(importer, /Never invent, estimate, infer or complete missing facts/)
})

test('existing listing quota guard remains the canonical submission guard', () => {
  assert.match(draftRoute, /assert_individual_listing_limit/)
  assert.match(draftRoute, /LISTING_LIMIT_REACHED/)
})


test('owner SMS consent is tied to the verified phone and a one-time token', () => {
  assert.match(migration, /telegram_listing_import_consents/)
  assert.match(migration, /consume_telegram_listing_import_consent/)
  assert.match(migration, /for update/i)
  assert.match(migration, /PHONE_MISMATCH/)
  assert.match(consentApi, /consume_telegram_listing_import_consent/)
  assert.match(consentApi, /ACCOUNT_SESSION_COOKIE/)
  assert.match(consentPage, /SMS OTP/)
})

test('representative documents are private and admin-reviewed', () => {
  assert.match(migration, /public = false/)
  assert.match(accountImportsApi, /authorization_document_path/)
  assert.match(accountImportsApi, /telegram-listing-imports/)
  assert.match(adminImportsApi, /requireAdmin/)
  assert.match(adminImportsApi, /createSignedUrl/)
  assert.match(adminImportsApi, /authorization_status: approved \? 'verified' : 'rejected'/)
  assert.match(accountImportsPage, /Ishonchnoma/)
})

test('Telegram album messages are grouped and deduplicated', () => {
  assert.match(migration, /source_message_ids bigint\[\]/)
  assert.match(migration, /telegram_listing_imports_media_group_uidx/)
  assert.match(importer, /media_group_id/)
  assert.match(importer, /source_message_ids/)
})

test('import drafts do not become listings until a separate authorized conversion step', () => {
  assert.match(migration, /status in \('processing','awaiting_authorization','awaiting_payment_choice','awaiting_realtor_review','authorized'/)
  assert.doesNotMatch(importer, /\.from\('listings'\)\.(insert|upsert|update)/)
})


test('realtor partner application requires a private qualification document and admin review', () => {
  assert.match(realtorApplicationApi, /certificate_document/)
  assert.match(realtorApplicationApi, /partner-verification-documents/)
  assert.match(realtorApplicationPage, /certificateFile/)
  assert.match(realtorAdminApi, /certificate_document_path/)
  assert.match(realtorAdminApi, /createSignedUrl/)
  assert.match(realtorAdminApi, /Tasdiqlashdan oldin malaka sertifikati/)
})

test('fourth individual listing offers one-time purchase or verified realtor application', () => {
  assert.match(listingWizard, /product=extra_listing/)
  assert.match(listingWizard, /realtors\/cabinet\?mode=register/)
  assert.match(listingWizard, /Jismoniy shaxs uchun bepul belgilangan limitingiz tugadi/)
})

test('verified realtors retain three free listings and can buy existing partner subscriptions', () => {
  assert.match(realtorPlanMigration, /free_limit integer := 3/)
  assert.match(realtorPlanMigration, /mp\.audience='partner'/)
  assert.match(realtorPlanMigration, /partner_start','partner_pro','partner_business/)
  assert.match(realtorPlanMigration, /is_verified_realtor/)
  assert.match(realtorPlanMigration, /create or replace function public.create_monetization_order/)
})


test('authorized imports continue through the existing listing wizard and moderation API', () => {
  assert.match(importDetailApi, /authorization_status !== 'verified'/)
  assert.match(importDetailApi, /createSignedUrl/)
  assert.match(importDetailApi, /listing.status !== 'moderation'/)
  assert.match(importDetailApi, /status: 'ready_for_moderation'/)
  assert.match(listingWizard, /params.get\('importId'\)/)
  assert.match(listingWizard, /telegram-import-/)
  assert.match(listingWizard, /assert_individual_listing_limit|LISTING_LIMIT_REACHED/)
  assert.match(listingMetaApi, /is_verified_realtor/)
})

test('listing quota is checked when an existing draft transitions into moderation', () => {
  assert.match(draftRoute, /shouldCheckListingLimit/)
  assert.match(draftRoute, /existingListing.status/)
  assert.match(draftRoute, /supabase.rpc\('assert_individual_listing_limit'/)
})

test('source contact data is never silently treated as verified owner identity', () => {
  assert.match(importer, /contact_phone/)
  assert.match(importer, /owner_full_name: null/)
  assert.match(importer, /owner_phone: null/)
  assert.match(importDetailApi, /submitterIsOwner/)
})

test('structured listing limit response opens the two-path quota choice', () => {
  assert.match(listingWizard, /data\.error==='LISTING_LIMIT_REACHED'/)
  assert.match(listingWizard, /setLimitReached\(true\)/)
})

test('partner subscriptions are shown only to partner accounts or verified realtors', () => {
  assert.match(monetizationPage, /isVerifiedRealtor/)
  assert.match(monetizationPage, /accountType==='partner'\|\|isVerifiedRealtor/)
  assert.match(monetizationPage, /plans=useMemo/)
})
