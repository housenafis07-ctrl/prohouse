import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

type TelegramUpdate = {
  message?: {
    text?: string
    chat?: { id?: number; type?: string }
    from?: { id?: number; username?: string; first_name?: string; last_name?: string }
  }
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret && request.headers.get('x-telegram-bot-api-secret-token') !== expectedSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const update = (await request.json()) as TelegramUpdate
    const message = update.message
    const text = String(message?.text || '').trim()
    const chatId = message?.chat?.id
    if (!message || !text || !chatId) return NextResponse.json({ ok: true })

    if (text.startsWith('/start')) {
      return NextResponse.json({ ok: true })
    }

    const from = message.from
    const name = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim()

    const admin = serviceClient()
    const { error } = await admin.from('support_messages').insert({
      name: name || null,
      subject: 'Telegram murojaati',
      message: text.slice(0, 5000),
      source: 'telegram',
      telegram_user_id: String(from?.id || chatId),
      telegram_username: from?.username ? '@' + from.username : null,
    })

    if (error) {
      console.error('telegram support insert failed', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('telegram webhook failed', error)
    return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
  }
}
