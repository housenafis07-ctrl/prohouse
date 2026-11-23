import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const setupKey = process.env.TELEGRAM_WEBHOOK_SETUP_KEY
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')
  const previewUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
  const baseUrl = process.env.VERCEL_ENV === 'production' || !previewUrl ? siteUrl : previewUrl
  return { token, secret, setupKey, webhookUrl: `${baseUrl}/api/telegram/webhook` }
}

function constantTimeMatch(received: string | null, expected: string) {
  if (!received) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function authorizeSetup(request: NextRequest, setupKey: string | undefined) {
  if (!setupKey) return false
  return constantTimeMatch(request.headers.get('x-telegram-webhook-setup-key'), setupKey)
}

function configurationError(config: ReturnType<typeof getConfig>) {
  if (!config.token) return 'TELEGRAM_BOT_TOKEN is not configured'
  if (!config.secret) return 'TELEGRAM_WEBHOOK_SECRET is not configured'
  if (!config.setupKey) return 'TELEGRAM_WEBHOOK_SETUP_KEY is not configured'
  return null
}

export async function GET(request: NextRequest) {
  const config = getConfig()
  const error = configurationError(config)
  if (error) return NextResponse.json({ ok: false, error }, { status: 503 })
  if (!authorizeSetup(request, config.setupKey)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const response = await fetch(`https://api.telegram.org/bot${config.token}/getWebhookInfo`, { cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  return NextResponse.json({ ok: response.ok && data.ok === true, expectedWebhookUrl: config.webhookUrl, telegram: data }, { status: response.ok ? 200 : 502 })
}

export async function POST(request: NextRequest) {
  const config = getConfig()
  const error = configurationError(config)
  if (error) return NextResponse.json({ ok: false, error }, { status: 503 })
  if (!authorizeSetup(request, config.setupKey)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const response = await fetch(`https://api.telegram.org/bot${config.token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: config.webhookUrl, secret_token: config.secret, allowed_updates: ['message'] }),
  })
  const data = await response.json().catch(() => ({}))
  return NextResponse.json({ ok: response.ok && data.ok === true, webhookUrl: config.webhookUrl, telegram: data }, { status: response.ok ? 200 : 502 })
}
