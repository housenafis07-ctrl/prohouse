import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../supabase/migrations/20261111170000_add_telegram_marketing_consent.sql', import.meta.url), 'utf8')
const webhook = await readFile(new URL('../app/api/telegram/webhook/route.ts', import.meta.url), 'utf8')
const registration = await readFile(new URL('../app/register/page.tsx', import.meta.url), 'utf8')

test('marketing eligibility is recorded as part of public-offer acceptance', () => {
  assert.match(migration, /offer_consents[\s\S]*marketing_consent boolean not null default false/i)
  assert.match(migration, /oc\.marketing_consent = true/)
  assert.match(registration, /marketing_consent:\s*true/)
})

test('existing users are not silently enrolled by migration', () => {
  assert.match(migration, /default false/i)
  assert.doesNotMatch(migration, /update public\.offer_consents[\s\S]*marketing_consent\s*=\s*true/i)
})

test('broadcast recipient counts and delivery share the same offer-consent rule', () => {
  assert.equal((migration.match(/oc\.marketing_consent = true/g) || []).length, 3)
})

test('no separate Telegram subscribe command is required', () => {
  assert.doesNotMatch(webhook, /\/subscribe/)
  assert.match(webhook, /text === '\/unsubscribe'/)
  assert.match(webhook, /update\(\{ marketing_consent: false \}\)/)
})

test('SMS OTP-only authentication remains unchanged', () => {
  assert.match(webhook, /SMS OTP kodi orqali/)
  assert.match(webhook, /Telegram orqali kirish va ro‘yxatdan o‘tish o‘chirilgan/)
  assert.doesNotMatch(webhook, /telegram_otp|telegramOtp|otp_code/i)
})

test('eligible-count SQL function uses a valid dollar-quoted body', () => {
  assert.ok(migration.includes('create or replace function public.get_telegram_marketing_eligible_count()\nreturns bigint\nlanguage sql\nsecurity definer\nset search_path = public, pg_temp\nas $$'))
  assert.ok(migration.includes('\n$$;\n\nrevoke all on function public.get_telegram_marketing_eligible_count()'))
})

test('existing users must accept the current offer before becoming marketing-eligible', () => {
  assert.ok(registration.includes('setOfferAcceptanceOnly(true)'))
  assert.ok(registration.includes('async function acceptCurrentOffer'))
  assert.ok(registration.includes(".eq('marketing_consent', true)"))
})

const adminTelegramPage = await readFile(new URL('../app/admin/telegram/page.tsx', import.meta.url), 'utf8')
const testRecipientsRoute = await readFile(new URL('../app/api/admin/telegram/test-recipients/route.ts', import.meta.url), 'utf8')
const broadcastRoute = await readFile(new URL('../app/api/admin/telegram/broadcast/route.ts', import.meta.url), 'utf8')

test('admin marketing page offers a selected opted-in customer for test delivery', () => {
  assert.match(adminTelegramPage, /fetch\('\/api\/admin\/telegram\/test-recipients'/)
  assert.match(adminTelegramPage, /telegram-test-recipient/)
  assert.match(adminTelegramPage, /selectedTestRecipient/)
  assert.match(adminTelegramPage, /action: 'test_client'/)
  assert.match(adminTelegramPage, /recipientTelegramId: selectedTestRecipient/)
  assert.doesNotMatch(adminTelegramPage, /Telegram ulanishi/)
  assert.doesNotMatch(adminTelegramPage, /async function connectTelegram/)
})

test('test recipient list is admin-only and only exposes recipients returned by the consent eligibility RPC', () => {
  assert.match(testRecipientsRoute, /requireAdmin\('listings\.moderate'\)/)
  assert.match(testRecipientsRoute, /get_telegram_broadcast_recipients/)
  assert.match(testRecipientsRoute, /\.eq\('is_active', true\)/)
  assert.match(testRecipientsRoute, /\.not\('profile_id', 'is', null\)/)
  assert.match(testRecipientsRoute, /maskedPhone/)
  assert.doesNotMatch(testRecipientsRoute, /service_role|SUPABASE_SERVICE_ROLE_KEY/)
})

test('test delivery revalidates the selected Telegram user consent server-side', () => {
  const testBlock = broadcastRoute.slice(broadcastRoute.indexOf("if (action === 'test_client')"), broadcastRoute.indexOf("if (destination === 'bot' && !['all'"))
  assert.match(testBlock, /get_telegram_broadcast_recipients/)
  assert.match(testBlock, /eligible.*some/)
  assert.match(testBlock, /\.eq\('telegram_user_id', recipientTelegramId\)/)
  assert.match(testBlock, /\.eq\('is_active', true\)/)
  assert.match(testBlock, /\.not\('profile_id', 'is', null\)/)
  assert.match(testBlock, /sendCampaignMessage\(recipient\.chat_id/)
  assert.doesNotMatch(testBlock, /body\.chatId|body\.chat_id/)
})
