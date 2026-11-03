import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/admin/auth'

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin('listings.moderate')
  if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN sozlanmagan.' }, { status: 500 })
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'TELEGRAM_WEBHOOK_SECRET sozlanmagan.' }, { status: 503 })
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')
  const webhookUrl = `${siteUrl}/api/telegram/webhook`
  const body: Record<string, unknown> = { url: webhookUrl, allowed_updates: ['message'] }
  body.secret_token = secret
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) return NextResponse.json({ error: data.description || 'Telegram webhookni yangilab bo‘lmadi.', webhookUrl }, { status: 502 })
  return NextResponse.json({ ok: true, webhookUrl, message: 'Telegram webhook joriy RoyalHouse deploymentiga ulandi.' })
}
