import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'
import { getTelegramAudience } from '@/app/api/admin/telegram/audience/route'

export const dynamic = 'force-dynamic'

const AUDIENCE_ALIASES: Record<string, 'all' | 'buyers' | 'listings' | 'realtors' | 'trusted'> = {
  all: 'all',
  buyers: 'buyers',
  xaridorlar: 'buyers',
  listings: 'listings',
  listing_authors: 'listings',
  e_l_on_joylaganlar: 'listings',
  'e\'lon joylaganlar': 'listings',
  realtors: 'realtors',
  rieltorlar: 'realtors',
  trusted: 'trusted',
  trusted_partners: 'trusted',
  'ishonchli hamkorlar': 'trusted',
}

function normalizeAudience(value: unknown) {
  const key = String(value || 'all').trim().toLowerCase()
  return AUDIENCE_ALIASES[key] || null
}

async function sendTelegramMessage(
  token: string,
  chatId: string,
  message: string,
  buttonText?: string | null,
  buttonUrl?: string | null,
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: message.slice(0, 4096),
    disable_web_page_preview: false,
  }

  if (buttonText && buttonUrl) {
    body.reply_markup = {
      inline_keyboard: [[{ text: buttonText.slice(0, 64), url: buttonUrl }]],
    }
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const data = await response.json()
  if (!response.ok || !data.ok) {
    const error = new Error(data.description || 'Telegram xabar yuborilmadi') as Error & { telegramCode?: number }
    error.telegramCode = Number(data.error_code || response.status)
    throw error
  }
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const db = serviceClient()
    const { data, error: queryError } = await db
      .from('telegram_broadcast_campaigns')
      .select('id,title,message,audience,button_text,button_url,recipient_count,sent_count,failed_count,created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (queryError) throw queryError
    return NextResponse.json({ campaigns: data || [] })
  } catch (error) {
    console.error('telegram campaign history failed', error)
    return NextResponse.json({ error: 'Kampaniyalar tarixini yuklab bo‘lmadi.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { admin, error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const body = await request.json() as {
      title?: string
      message?: string
      audience?: string
      buttonText?: string | null
      buttonUrl?: string | null
    }

    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()
    const audience = normalizeAudience(body.audience)
    const buttonText = body.buttonText ? String(body.buttonText).trim() : null
    const buttonUrl = body.buttonUrl ? String(body.buttonUrl).trim() : null

    if (!title) return NextResponse.json({ error: 'Sarlavha kiriting.' }, { status: 400 })
    if (!message) return NextResponse.json({ error: 'Xabar matnini kiriting.' }, { status: 400 })
    if (!audience) return NextResponse.json({ error: 'Auditoriya noto‘g‘ri tanlangan.' }, { status: 400 })
    if (buttonText && !buttonUrl) return NextResponse.json({ error: 'Tugma havolasini kiriting.' }, { status: 400 })
    if (buttonUrl && !/^https?:\/\//i.test(buttonUrl)) return NextResponse.json({ error: 'Tugma havolasi http:// yoki https:// bilan boshlanishi kerak.' }, { status: 400 })

    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN sozlanmagan.' }, { status: 500 })

    const db = serviceClient()
    const recipients = await getTelegramAudience(db, audience)

    const { data: campaign, error: campaignError } = await db
      .from('telegram_broadcast_campaigns')
      .insert({
        title,
        message,
        audience,
        button_text: buttonText,
        button_url: buttonUrl,
        recipient_count: recipients.length,
        created_by: admin!.user.id,
      })
      .select('id')
      .single()

    if (campaignError) throw campaignError

    let sent = 0
    let failed = 0

    for (const recipient of recipients) {
      try {
        await sendTelegramMessage(token, recipient.chat_id, `📢 ${title}\n\n${message}`, buttonText, buttonUrl)
        sent += 1
      } catch (sendError) {
        failed += 1
        const telegramCode = (sendError as Error & { telegramCode?: number }).telegramCode
        if (telegramCode === 400 || telegramCode === 403) {
          await db
            .from('telegram_bot_users')
            .update({ is_blocked: true })
            .eq('id', recipient.id)
        }
      }

      // Telegram bot broadcasts should stay below the platform's normal send rate.
      await new Promise(resolve => setTimeout(resolve, 40))
    }

    await db
      .from('telegram_broadcast_campaigns')
      .update({ sent_count: sent, failed_count: failed })
      .eq('id', campaign.id)

    return NextResponse.json({
      ok: true,
      campaignId: campaign.id,
      recipientCount: recipients.length,
      sent,
      failed,
    })
  } catch (error) {
    console.error('telegram broadcast failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Telegram xabarini yuborib bo‘lmadi.' }, { status: 500 })
  }
}
