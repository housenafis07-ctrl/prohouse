import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/utils/admin/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function telegram(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_MODERATION_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_MODERATION_BOT_TOKEN is not configured')
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), cache: 'no-store',
  })
  const result = await response.json()
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram ${method} failed`)
  return result.result
}

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  return NextResponse.json({
    configured: Boolean(process.env.TELEGRAM_MODERATION_BOT_TOKEN && process.env.TELEGRAM_MODERATION_WEBHOOK_SECRET),
    groupConfigured: Boolean(process.env.ROYALHOUSE_MODERATION_GROUP_ID),
    moderatorCount: (process.env.ROYALHOUSE_MODERATOR_TELEGRAM_IDS || '').split(',').map(x => x.trim()).filter(x => /^\d+$/.test(x)).length,
    webhookUrl: `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')}/api/telegram/moderation/webhook`,
  })
}

export async function POST() {
  const { error } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const token = process.env.TELEGRAM_MODERATION_BOT_TOKEN
  const secret = process.env.TELEGRAM_MODERATION_WEBHOOK_SECRET
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')
  if (!token || !secret) return NextResponse.json({ error: 'Bot token yoki webhook secret sozlanmagan.' }, { status: 409 })
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) return NextResponse.json({ error: 'Webhook secret Telegram talablariga mos emas.' }, { status: 400 })

  try {
    const result = await telegram('setWebhook', {
      url: `${siteUrl}/api/telegram/moderation/webhook`,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    })
    await telegram('setMyCommands', {
      commands: [
        { command: 'start', description: 'Moderator botini boshlash' },
        { command: 'chatid', description: 'Guruh yoki shaxsiy chat ID sini ko‘rish' },
      ],
    })
    return NextResponse.json({ ok: true, webhook: result, webhookUrl: `${siteUrl}/api/telegram/moderation/webhook` })
  } catch (error) {
    console.error('[admin/telegram/moderation/setup] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook sozlanmadi' }, { status: 502 })
  }
}
