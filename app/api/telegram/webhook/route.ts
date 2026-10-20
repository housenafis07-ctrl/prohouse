import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { serviceClient } from '@/utils/admin/auth'

type TelegramUpdate = {
  message?: {
    text?: string
    chat?: { id?: number; type?: string }
    from?: { id?: number; username?: string; first_name?: string; last_name?: string }
  }
}

async function sendTelegramMessage(chatId: string | number, text: string, includeMiniApp = false) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz'
  const body: Record<string, unknown> = { chat_id: chatId, text, disable_web_page_preview: true }
  if (includeMiniApp) body.reply_markup = { inline_keyboard: [[{ text: '🚀 Royalhouse’ni ochish', web_app: { url: siteUrl } }]] }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  })
  const data = await response.json()
  if (!response.ok || !data.ok) throw new Error(data.description || 'Telegram sendMessage failed')
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret && request.headers.get('x-telegram-bot-api-secret-token') !== expectedSecret) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const update = (await request.json()) as TelegramUpdate
    const message = update.message
    const text = String(message?.text || '').trim()
    const chatId = message?.chat?.id
    if (!message || !text || !chatId) return NextResponse.json({ ok: true })

    const from = message.from
    const admin = serviceClient()

    if (text.startsWith('/start')) {
      const payload = text.split(/\s+/, 2)[1] || ''
      if (!payload.startsWith('link_')) {
        await sendTelegramMessage(chatId, 'Assalomu alaykum! Royalhouse’da uy qidiring, e’lon joylang va bronlarni boshqaring. Telegram orqali avtomatik kirish mumkin — SMS kod kerak emas.', true)
        return NextResponse.json({ ok: true })
      }
      if (!from?.id) {
        await sendTelegramMessage(chatId, 'Telegram foydalanuvchisi aniqlanmadi. Saytdan yangi ulash havolasini oling.')
        return NextResponse.json({ ok: true })
      }

      const rawToken = payload.slice(5)
      if (!/^[a-f0-9]{48}$/i.test(rawToken)) {
        await sendTelegramMessage(chatId, 'Ulash havolasi noto‘g‘ri. Royalhouse shaxsiy kabinetidan yangi havola oling.')
        return NextResponse.json({ ok: true })
      }
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      const { data: token, error: tokenError } = await admin.from('telegram_link_tokens')
        .select('profile_id,expires_at,used_at').eq('token_hash', tokenHash).maybeSingle()
      if (tokenError) throw tokenError
      if (!token || token.used_at || new Date(token.expires_at).getTime() <= Date.now()) {
        await sendTelegramMessage(chatId, 'Ulash havolasi eskirgan yoki ishlatilgan. Royalhouse shaxsiy kabinetidan yangi havola yarating.')
        return NextResponse.json({ ok: true })
      }

      const { data: existingByTelegram, error: existingTelegramError } = await admin.from('telegram_user_links')
        .select('profile_id').eq('telegram_user_id', String(from.id)).maybeSingle()
      if (existingTelegramError) throw existingTelegramError
      if (existingByTelegram && existingByTelegram.profile_id !== token.profile_id) {
        await sendTelegramMessage(chatId, 'Bu Telegram akkaunti boshqa Royalhouse profiliga ulangan. Profil almashtirilmaydi.')
        return NextResponse.json({ ok: true })
      }

      const { data: existingByProfile, error: existingProfileError } = await admin.from('telegram_user_links')
        .select('telegram_user_id').eq('profile_id', token.profile_id).maybeSingle()
      if (existingProfileError) throw existingProfileError
      if (existingByProfile && existingByProfile.telegram_user_id !== String(from.id)) {
        await sendTelegramMessage(chatId, 'Bu Royalhouse profili boshqa Telegram akkauntiga ulangan. Profil almashtirilmaydi.')
        return NextResponse.json({ ok: true })
      }

      const now = new Date().toISOString()
      const { error: linkError } = await admin.from('telegram_user_links').upsert({
        profile_id: token.profile_id,
        telegram_user_id: String(from.id),
        chat_id: String(chatId),
        telegram_username: from.username || null,
        linked_at: now,
        verified_at: now,
        verification_method: 'bot_link_token',
      }, { onConflict: 'telegram_user_id' })
      if (linkError) {
        await sendTelegramMessage(chatId, 'Telegram ulanishida xatolik yuz berdi. Profil almashtirilmadi.')
        return NextResponse.json({ ok: true })
      }

      const { error: usedError } = await admin.from('telegram_link_tokens').update({ used_at: now }).eq('token_hash', tokenHash).is('used_at', null)
      if (usedError) throw usedError
      await sendTelegramMessage(chatId, '✅ Telegram akkauntingiz Royalhouse profiliga ulandi! Endi Royalhouse’ni shu yerdan bir bosishda ochishingiz mumkin.', true)
      return NextResponse.json({ ok: true })
    }

    const name = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim()
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
    await sendTelegramMessage(chatId, 'Xabaringiz Royalhouse qo‘llab-quvvatlash xizmatiga yuborildi.', true)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('telegram webhook failed', error)
    return NextResponse.json({ error: 'Telegram webhook failed' }, { status: 500 })
  }
}
