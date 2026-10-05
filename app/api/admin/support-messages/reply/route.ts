import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const body = await request.json()
    const id = String(body?.id || '')
    const reply = String(body?.reply || '').trim().slice(0, 4000)

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    if (!reply) return NextResponse.json({ error: 'reply required' }, { status: 400 })

    const admin = serviceClient()
    const { data: message, error: dbError } = await admin
      .from('support_messages')
      .select('id,source,telegram_user_id')
      .eq('id', id)
      .single()

    if (dbError || !message) return NextResponse.json({ error: dbError?.message || 'Message not found' }, { status: 404 })

    if (message.source !== 'telegram' || !message.telegram_user_id) {
      return NextResponse.json({ error: 'This message is not a Telegram conversation' }, { status: 400 })
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 })

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.telegram_user_id,
        text: reply,
      }),
    })

    const telegramData = await telegramResponse.json().catch(() => ({}))
    if (!telegramResponse.ok || telegramData.ok !== true) {
      console.error('telegram admin reply failed', telegramData)
      return NextResponse.json({ error: telegramData.description || 'Telegram message could not be sent' }, { status: 502 })
    }

    await admin
      .from('support_messages')
      .update({ status: 'replied', admin_note: `Javob: ${reply}` })
      .eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('telegram admin reply failed', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
