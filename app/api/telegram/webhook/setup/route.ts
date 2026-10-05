import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')
  return { token, secret, webhookUrl: `${baseUrl}/api/telegram/webhook` }
}

export async function GET() {
  const { token, webhookUrl } = getConfig()
  if (!token) return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 })
  const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  return NextResponse.json({ ok: response.ok && data.ok === true, expectedWebhookUrl: webhookUrl, telegram: data })
}

export async function POST(request: NextRequest) {
  const { token, secret, webhookUrl } = getConfig()
  if (!token) return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 })
  const setupKey = process.env.TELEGRAM_WEBHOOK_SETUP_KEY
  if (setupKey && request.headers.get('x-telegram-webhook-setup-key') !== setupKey) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body: Record<string, unknown> = { url: webhookUrl, allowed_updates: ['message'] }
  if (secret) body.secret_token = secret
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  return NextResponse.json({ ok: response.ok && data.ok === true, webhookUrl, telegram: data }, { status: response.ok ? 200 : 502 })
}
