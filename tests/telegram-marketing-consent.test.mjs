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
  assert.equal((migration.match(/oc\.marketing_consent = true/g) || []).length, 2)
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
  assert.match(migration, /create or replace function public\\.get_telegram_marketing_eligible_count\\(\\)[\\s\\S]*?as \\\$\\\\?\\$/i)
  assert.match(migration, /marketing_consent = true[\\s\\S]*?\\n\\$\\$;/)
})
