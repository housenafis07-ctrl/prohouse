import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../app/api/admin/telegram/ai/route.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/admin/telegram/page.tsx', import.meta.url), 'utf8')

test('AI endpoint requires admin authorization and the configured OpenAI key', () => {
  assert.match(route, /requireAdmin\('listings\.moderate'\)/)
  assert.match(route, /process\.env\.OPENAI_API_KEY/)
})

test('AI recommendations use campaign history and offer-consented audience counts', () => {
  assert.match(route, /telegram_broadcast_campaigns/)
  assert.match(route, /get_telegram_broadcast_audience_counts/)
  assert.match(route, /recipient_count/)
  assert.match(route, /timeZone: 'Asia\/Tashkent'/)
})

test('AI route is draft-only and contains no Telegram sending or scheduling operation', () => {
  assert.match(route, /do not send, schedule, save, or publish/i)
  assert.match(route, /never send or schedule messages/i)
  assert.doesNotMatch(route, /sendMessage|sendPhoto|sendVideo/)
})

test('Admin UI provides AI generation and analysis without bypassing broadcast confirmation', () => {
  assert.match(page, /AI bilan yaratish/)
  assert.match(page, /AI tahlil/)
  assert.match(page, /window\.confirm/)
  assert.match(page, /runMarketingAi/)
})
