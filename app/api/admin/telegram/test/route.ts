import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export const dynamic = 'force-dynamic'

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
    cache: 'no-store',
  })

  const data = await response.json()
  if (!response.ok || !data.ok) throw new Error(data.description || 'Telegram xabar yuborilmadi')
}

export async function POST(request: Request) {
  const { admin, error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const db = serviceClient()
    const { data: link, error: linkError } = await db
      .from('telegram_user_links')
      .select('chat_id,telegram_user_id')
      .eq('profile_id', admin!.user.id)
      .maybeSingle()

    if (linkError) throw linkError

    let chatId = link?.chat_id || null

    if (!chatId) {
      const { data: botUser, error: botUserError } = await db
        .from('telegram_bot_users')
        .select('chat_id')
        .eq('profile_id', admin!.user.id)
        .eq('is_blocked', false)
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (botUserError) throw botUserError
      chatId = botUser?.chat_id || null
    }

    if (!chatId) {
      return NextResponse.json({
        error: 'Admin Telegram akkaunti hali RoyalHouse profiliga ulanmagan. Avval @RoyalHouseUz_bot ga /start yuboring va Telegramni profilingiz bilan ulang.',
      }, { status: 400 })
    }

    const body = await request.json().catch(() => ({})) as { title?: string; message?: string }
    const title = String(body.title || 'RoyalHouse test xabari').trim()
    const message = String(body.message || 'Bu RoyalHouse Telegram botining test xabari.').trim()

    await sendTelegramMessage(chatId, `🧪 ${title}\n\n${message}`)

    return NextResponse.json({ ok: true, chatId })
  } catch (error) {
    console.error('telegram test failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Test xabarini yuborib bo‘lmadi.' }, { status: 500 })
  }
}
