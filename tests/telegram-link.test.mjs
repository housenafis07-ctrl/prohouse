import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const route = await readFile(new URL('../app/api/account/telegram/auto-link/route.ts', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261109170000_link_telegram_identity_atomically.sql', import.meta.url), 'utf8')
const miniApp = await readFile(new URL('../app/lib/telegram-miniapp.ts', import.meta.url), 'utf8')

test('existing and new phone accounts use the same authenticated profile binding', () => {
  assert.match(route, /auth\.auth\.getUser\(\)/)
  assert.match(route, /db\.rpc\('link_telegram_identity'/)
  assert.match(migration, /select phone into v_phone[\s\S]*if v_phone is null/)
})

test('Telegram identity conflicts are rejected without account merging', () => {
  assert.match(migration, /TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE/)
  assert.match(migration, /PROFILE_ALREADY_LINKED_TO_ANOTHER_TELEGRAM/)
  assert.match(route, /CONFLICT_ERRORS/)
  assert.match(route, /merged: false/)
  assert.doesNotMatch(route, /delete\(/)
})

test('link and bot registry writes execute inside one database function transaction', () => {
  assert.match(migration, /^begin;/)
  assert.match(migration, /insert into public\.telegram_user_links/)
  assert.match(migration, /insert into public\.telegram_bot_users/)
  assert.match(migration, /raise exception 'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE'/)
  assert.match(migration, /grant execute on function public\.link_telegram_identity[\s\S]*to service_role/)
  assert.match(route, /db\.rpc\('link_telegram_identity'/)
  assert.doesNotMatch(route, /\.from\('telegram_user_links'\)/)
  assert.doesNotMatch(route, /\.from\('telegram_bot_users'\)/)
})

test('Telegram initData is validated server-side with a ten-minute freshness window', () => {
  assert.match(route, /validateTelegramInitData\(initData, 10 \* 60\)/)
  assert.match(miniApp, /timingSafeEqual/)
  assert.match(miniApp, /params\.delete\('hash'\)/)
})

test('legacy Telegram-authenticated sessions cannot bypass phone verification', () => {
  assert.match(route, /auth_provider === 'telegram'[\s\S]*PHONE_AUTH_REQUIRED/)
})
