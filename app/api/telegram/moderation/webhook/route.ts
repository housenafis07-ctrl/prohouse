import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  answerModerationCallback,
  editModerationMessage,
  processModerationDecision,
  promptModerationRejection,
} from '@/utils/telegram/moderation'
import { serviceClient } from '@/utils/admin/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TelegramUpdate = {
  message?: {
    message_id?: number
    text?: string
    chat?: { id?: number; type?: string }
    from?: { id?: number; username?: string; first_name?: string }
    reply_to_message?: { text?: string; message_id?: number; reply_to_message?: { message_id?: number } }
  }
  callback_query?: {
    id?: string
    data?: string
    from?: { id?: number; username?: string }
    message?: { message_id?: number; chat?: { id?: number } }
  }
}

function secretMatches(received: string | null, expected: string) {
  if (!received || received.length !== expected.length) return false
  try { return timingSafeEqual(Buffer.from(received), Buffer.from(expected)) } catch { return false }
}

async function isModerator(id: number | undefined) {
  if (!id) return false
  const telegramUserId = String(id)
  const db = serviceClient()
  const { data, error } = await db.from('telegram_moderators')
    .select('is_active').eq('telegram_user_id', telegramUserId).maybeSingle()
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return (process.env.ROYALHOUSE_MODERATOR_TELEGRAM_IDS || '').split(',').map(value => value.trim()).includes(telegramUserId)
    }
    throw error
  }
  if (data) return data.is_active === true

  // Backward-compatible bootstrap: existing env-listed moderators retain
  // access until they /start the bot and are materialized in the DB.
  const legacy = (process.env.ROYALHOUSE_MODERATOR_TELEGRAM_IDS || '')
    .split(',').map(value => value.trim())
  return legacy.includes(telegramUserId)
}

async function linkModeratorFromInvite(chatId: number, user: { id: number; username?: string; first_name?: string }, rawToken: string) {
  if (!/^[a-f0-9]{64}$/i.test(rawToken)) return false
  const db = serviceClient()
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const now = new Date().toISOString()
  const { data: invite, error: inviteError } = await db.from('telegram_moderator_invites')
    .update({ used_at: now, used_by_telegram_id: String(user.id) })
    .eq('token_hash', tokenHash).is('used_at', null).gt('expires_at', now)
    .select('id,created_by').maybeSingle()
  if (inviteError) throw inviteError
  if (!invite) return false

  const { error: upsertError } = await db.from('telegram_moderators').upsert({
    telegram_user_id: String(user.id),
    chat_id: String(chatId),
    username: user.username || null,
    first_name: user.first_name || null,
    is_active: true,
    invited_by: invite.created_by || null,
    linked_at: now,
    updated_at: now,
  }, { onConflict: 'telegram_user_id' })
  if (upsertError) throw upsertError
  return true
}

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

async function send(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  await telegram('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...extra })
}

export async function POST(request: NextRequest) {
  const expected = process.env.TELEGRAM_MODERATION_WEBHOOK_SECRET
  if (!expected) return NextResponse.json({ error: 'Moderation webhook is not configured' }, { status: 503 })
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token'), expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const update = await request.json() as TelegramUpdate

    if (update.callback_query) {
      const callback = update.callback_query
      const telegramUserId = String(callback.from?.id || '')
      if (!await isModerator(callback.from?.id)) {
        if (callback.id) await answerModerationCallback(callback.id, 'Sizga moderatsiya huquqi berilmagan.', true)
        return NextResponse.json({ ok: true })
      }
      const match = /^(approve|reject):([0-9a-f-]{36})$/i.exec(callback.data || '')
      if (!match || !callback.id || !callback.message?.chat?.id || !callback.message.message_id) {
        if (callback.id) await answerModerationCallback(callback.id, 'Tugma ma’lumoti noto‘g‘ri.', true)
        return NextResponse.json({ ok: true })
      }
      const [, action, listingId] = match
      if (action === 'reject') {
        await promptModerationRejection(callback.message.chat.id, callback.message.message_id, listingId)
        await answerModerationCallback(callback.id, 'Rad etish sababini Reply qilib yuboring.')
        return NextResponse.json({ ok: true })
      }
      try {
        const listing = await processModerationDecision(listingId, 'approve', '', telegramUserId, callback.message.chat.id)
        await answerModerationCallback(callback.id, 'E’lon tasdiqlandi.')
        await editModerationMessage(callback.message.chat.id, callback.message.message_id,
          `✅ E’lon tasdiqlandi: ${listing.listing_code || listing.id} (@${callback.from?.username || telegramUserId})`)
      } catch (error) {
        const message = error instanceof Error && error.message === 'LISTING_ALREADY_MODERATED'
          ? 'Bu e’lon boshqa moderator tomonidan ko‘rib chiqilgan.'
          : 'Tasdiqlash amalga oshmadi. Admin panelni tekshiring.'
        await answerModerationCallback(callback.id, message, true)
      }
      return NextResponse.json({ ok: true })
    }

    const message = update.message
    if (!message?.chat?.id || !message.from?.id) return NextResponse.json({ ok: true })
    const chatId = message.chat.id
    const userId = message.from.id
    const text = (message.text || '').trim()

    if (text === '/start' || text.startsWith('/start ')) {
      const payload = text.split(/\s+/, 2)[1] || ''
      if (payload.startsWith('link_')) {
        if (message.chat.type !== 'private') {
          await send(chatId, 'Moderator taklif havolasini bot bilan shaxsiy chatda oching.')
          return NextResponse.json({ ok: true })
        }
        const linked = await linkModeratorFromInvite(chatId, { id: userId, username: message.from.username, first_name: message.from.first_name }, payload.slice(5))
        await send(chatId, linked
          ? '✅ Telegram akkauntingiz RoyalHouse moderatoriga muvaffaqiyatli bog‘landi. Endi moderatsiya xabarlari shu chatga keladi.'
          : '❌ Taklif havolasi yaroqsiz, muddati tugagan yoki avval ishlatilgan. Admin paneldan yangi havola so‘rang.')
        return NextResponse.json({ ok: true })
      }
      const legacyIds = (process.env.ROYALHOUSE_MODERATOR_TELEGRAM_IDS || '').split(',').map(value => value.trim())
      if (legacyIds.includes(String(userId))) {
        const db = serviceClient()
        const { error: syncError } = await db.from('telegram_moderators').upsert({
          telegram_user_id: String(userId), chat_id: String(chatId),
          username: message.from.username || null, first_name: message.from.first_name || null,
          is_active: true, linked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }, { onConflict: 'telegram_user_id', ignoreDuplicates: true })
        if (syncError && syncError.code !== 'PGRST205' && syncError.code !== '42P01') throw syncError
      }
      if (!await isModerator(userId)) {
        await send(chatId, 'RoyalHouse Moderatsiya botiga xush kelibsiz. Ushbu bot faqat ruxsat berilgan moderatorlar uchun.')
      } else {
        await send(chatId, '✅ Siz moderator sifatida tanildingiz. Yangi e’lonlar yopiq guruhga va shaxsiy xabaringizga yuboriladi. Rad etishda bot xabariga Reply qilib sababni yozing.')
      }
      return NextResponse.json({ ok: true })
    }

    if (text === '/chatid') {
      await send(chatId, `Chat ID: ${chatId}\nTelegram user ID: ${userId}`)
      return NextResponse.json({ ok: true })
    }

    if (message.reply_to_message?.text && await isModerator(userId)) {
      const idMatch = /E’lon ID:\s*([0-9a-f-]{36})/i.exec(message.reply_to_message.text)
      if (idMatch && text && !text.startsWith('/')) {
        try {
          const listing = await processModerationDecision(idMatch[1], 'reject', text.slice(0, 1000), String(userId), chatId)
          const resultText = `❌ E’lon rad etildi va tuzatish uchun qaytarildi: ${listing.listing_code || listing.id}\nSabab: ${text.slice(0, 1000)}`
          const originalMessageId = message.reply_to_message.reply_to_message?.message_id
          if (originalMessageId) await editModerationMessage(chatId, originalMessageId, resultText)
          else await send(chatId, resultText)
        } catch (error) {
          await send(chatId, error instanceof Error && error.message === 'LISTING_ALREADY_MODERATED'
            ? 'Bu e’lon boshqa moderator tomonidan ko‘rib chiqilgan.'
            : 'Rad etish amalga oshmadi. Admin panelni tekshiring.')
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[moderation-bot/webhook] update failed', error)
    return NextResponse.json({ error: 'Moderation bot update failed' }, { status: 500 })
  }
}
