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
  assert.doesNotMatch(webhook, /telegram.*OTP/i)
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

test('admin Telegram connect opens its popup synchronously before network awaits', () => {
  const handler = adminTelegramPage.slice(adminTelegramPage.indexOf('async function connectTelegram'), adminTelegramPage.indexOf('async function uploadMedia'))
  assert.ok(handler.indexOf("window.open('about:blank'") < handler.indexOf('await syncWebhook()'))
  assert.match(handler, /telegramWindow\.location\.replace\(d\.url\)/)
})

test('Telegram webhook handles the one-time link start payload and requests the owner contact', () => {
  assert.match(webhook, /payload\.startsWith\('link_'\)/)
  assert.match(webhook, /createHash\('sha256'\)\.update\(rawToken\)/)
  assert.match(webhook, /contact_requested_at/)
  assert.match(webhook, /await requestTelegramPhone\(chatId\)/)
})

test('Telegram linking verifies the sender-owned contact against the profile phone and consumes the token', () => {
  assert.match(webhook, /message\.contact\.user_id !== from\.id/)
  assert.match(webhook, /contactPhone !== profilePhone/)
  assert.match(webhook, /link_telegram_identity/)
  assert.match(webhook, /update\(\{ used_at: new Date\(\)\.toISOString\(\) \}\)/)
  assert.match(webhook, /verification_method: 'telegram_contact'/)
})

const adminTelegramLinkRoute = await readFile(new URL('../app/api/admin/telegram/link/route.ts', import.meta.url), 'utf8')

test('admin Telegram linking uses admin authorization rather than the customer account cookie', () => {
  assert.match(adminTelegramLinkRoute, /requireAdmin\('listings\.moderate'\)/)
  assert.match(adminTelegramLinkRoute, /\.from\('profiles'\).*\.eq\('id', admin\.user\.id\)/s)
  assert.match(adminTelegramLinkRoute, /\.from\('telegram_link_tokens'\)\.insert/)
  assert.doesNotMatch(adminTelegramLinkRoute, /readAccountSession|ACCOUNT_SESSION_COOKIE/)
  assert.match(adminTelegramPage, /fetch\('\/api\/admin\/telegram\/link'/)
})
