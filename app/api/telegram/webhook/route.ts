import { NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')

async function telegram(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Telegram API ${method} failed`)
  return response.json()
}

function keyboard() {
  const base = siteUrl()
  return {
    inline_keyboard: [
      [{ text: '🏠 Shaxsiy kabinet / Личный кабинет', web_app: { url: `${base}/account` } }],
      [{ text: '📢 E’lon joylashtirish / Разместить объявление', web_app: { url: `${base}/listings/new?source=telegram` } }],
      [{ text: '🏡 Dachalar / Дачи', web_app: { url: `${base}/listings?tab=rent&type=house&taxonomy=rent_dacha` } }],
      [{ text: '🔎 E’lonlarni ko‘rish / Объявления', web_app: { url: `${base}/listings` } }],
    ],
  }
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret && request.headers.get('x-telegram-bot-api-secret-token') !== secret) return NextResponse.json({ ok: false }, { status: 401 })

  const update = await request.json().catch(() => null) as any
  const message = update?.message
  if (!message?.chat?.id) return NextResponse.json({ ok: true })

  const chatId = Number(message.chat.id)
  const from = message.from || {}
  try {
    const admin = serviceClient()
    await admin.from('telegram_accounts').upsert({
      telegram_user_id: Number(from.id),
      username: from.username || null,
      first_name: from.first_name || null,
      last_name: from.last_name || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'telegram_user_id' })

    const text = typeof message.text === 'string' ? message.text.trim() : ''
    const reply = text.startsWith('/start')
      ? 'Royalhouse botiga xush kelibsiz! 🏡\n\nBu bot orqali shaxsiy kabinetingizga kirishingiz, istalgan turdagi e’lon joylashtirishingiz va dachalar uchun bo‘sh kunlarni ko‘rishingiz mumkin.'
      : 'Kerakli bo‘limni tanlang:'

    await telegram('sendMessage', { chat_id: chatId, text: reply, reply_markup: keyboard() })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'TELEGRAM_WEBHOOK_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'royalhouse-telegram-webhook' })
}
