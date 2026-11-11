import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../supabase/migrations/20261111170000_add_telegram_marketing_consent.sql', import.meta.url), 'utf8')
const webhook = await readFile(new URL('../app/api/telegram/webhook/route.ts', import.meta.url), 'utf8')

test('existing Telegram users are not silently enrolled in marketing', () => {
  assert.match(migration, /marketing_opt_in boolean not null default false/i)
  assert.match(migration, /marketing_consent_at timestamptz/i)
})

test('broadcast recipients and audience counts require explicit marketing opt-in', () => {
  assert.match(migration, /u\.marketing_opt_in = true/)
  assert.match(migration, /marketing_opt_in = true/)
})

test('Telegram users can opt in and opt out with commands', () => {
  assert.match(webhook, /text === '\/subscribe' \|\| text === '\/unsubscribe'/)
  assert.match(webhook, /marketing_consent_source: optedIn \? 'telegram_command' : null/)
  assert.match(webhook, /marketing_opt_in: optedIn/)
})

test('marketing preference handling does not alter SMS OTP authentication flow', () => {
  assert.match(webhook, /SMS OTP kodi orqali/)
  assert.doesNotMatch(webhook, /telegram.*OTP/i)
})
