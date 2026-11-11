import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/admin/auth'

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin('listings.moderate')
  if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })

  const token = process.env.TELEGRAM_BOT_TOKEN
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!token || !secret) {
    console.error('[admin/telegram/webhook] bot token or webhook secret is not configured')
    return NextResponse.json({ error: 'Telegram webhook configuration is incomplete.' }, { status: 503 })
  }

  const webhookUrl = `${request.nextUrl.origin}/api/telegram/webhook`
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ['message'] }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) {
    return NextResponse.json({ error: data.description || 'Telegram webhookni yangilab bo‘lmadi.', webhookUrl }, { status: 502 })
  }
  return NextResponse.json({ ok: true, webhookUrl, message: 'Telegram webhook joriy RoyalHouse deploymentiga ulandi.' })
}
