import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const webhook = await readFile(new URL('../app/api/telegram/webhook/route.ts', import.meta.url), 'utf8')
const setup = await readFile(new URL('../app/api/telegram/webhook/setup/route.ts', import.meta.url), 'utf8')
const adminSetup = await readFile(new URL('../app/api/admin/telegram/webhook/route.ts', import.meta.url), 'utf8')

test('Telegram webhook fails closed when secret is missing and compares supplied token safely', () => {
  assert.match(webhook, /if \(!expectedSecret\)[\s\S]*?status: 503/)
  assert.match(webhook, /timingSafeEqual/)
  assert.match(webhook, /x-telegram-bot-api-secret-token/)
  assert.match(webhook, /status: 403/)
})

test('public webhook setup GET and POST both require setup key and webhook secret', () => {
  assert.match(setup, /function configurationError/)
  assert.match(setup, /!config\.secret/)
  assert.match(setup, /!config\.setupKey/)
  assert.match(setup, /export async function GET\(request: NextRequest\)/)
  assert.match(setup, /export async function POST\(request: NextRequest\)/)
  assert.equal((setup.match(/authorizeSetup\(request, config\.setupKey\)/g) || []).length, 2)
  assert.match(setup, /secret_token: config\.secret/)
})

test('admin webhook setup cannot register a webhook without the secret', () => {
  assert.match(adminSetup, /requireAdmin\('listings\.moderate'\)/)
  assert.match(adminSetup, /if \(!token \|\| !secret\)[\s\S]*?status: 503/)
  assert.match(adminSetup, /secret_token: secret/)
})
