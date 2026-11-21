import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, serviceClient } from '@/utils/admin/auth'

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

export async function GET(request: NextRequest) {
  const { error } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  try {
    const { count, error: countError } = await serviceClient().from('telegram_moderators')
      .select('id', { count: 'exact', head: true }).eq('is_active', true)
    if (countError) throw countError
    return NextResponse.json({
      configured: Boolean(process.env.TELEGRAM_MODERATION_BOT_TOKEN && process.env.TELEGRAM_MODERATION_WEBHOOK_SECRET),
      groupConfigured: Boolean(process.env.ROYALHOUSE_MODERATION_GROUP_ID),
      moderatorCount: count ?? 0,
      webhookUrl: `${request.nextUrl.origin}/api/telegram/moderation/webhook`,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    console.error('[admin/telegram/moderation/setup] status failed', cause)
    return NextResponse.json({ error: 'Moderatorlar holatini tekshirib bo‘lmadi.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const token = process.env.TELEGRAM_MODERATION_BOT_TOKEN
  const secret = process.env.TELEGRAM_MODERATION_WEBHOOK_SECRET
  const siteUrl = request.nextUrl.origin
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
