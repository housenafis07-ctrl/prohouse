import { serviceClient } from '@/utils/admin/auth'

type ListingSummary = {
  id: string
  listing_code?: string | null
  title?: string | null
  price?: number | null
  currency?: string | null
  city?: string | null
  district?: string | null
  area_m2?: number | null
  rooms?: number | null
  owner_id?: string | null
  listing_type?: string | null
  property_type?: string | null
}

const SITE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')

function moderatorIds() {
  return (process.env.ROYALHOUSE_MODERATOR_TELEGRAM_IDS || '')
    .split(',').map(x => x.trim()).filter(x => /^\d+$/.test(x))
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

function price(value?: number | null, currency?: string | null) {
  if (value == null) return 'Narx ko‘rsatilmagan'
  return `${new Intl.NumberFormat('uz-UZ').format(value)} ${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'so‘m'}`
}

function moderationKeyboard(id: string) {
  return { inline_keyboard: [[
    { text: '✅ Tasdiqlash', callback_data: `approve:${id}` },
    { text: '❌ Rad etish', callback_data: `reject:${id}` },
  ], [{ text: '🖥 Admin panelda ochish', url: `${SITE_URL}/admin/moderation` }]] }
}

export async function notifyModeratorsAboutListing(listingId: string) {
  const token = process.env.TELEGRAM_MODERATION_BOT_TOKEN
  const groupId = process.env.ROYALHOUSE_MODERATION_GROUP_ID
  if (!token || !groupId) {
    console.warn('[moderation-bot] token or group id is not configured; notification skipped')
    return
  }

  const db = serviceClient()
  const { data: listing, error } = await db.from('listings')
    .select('id,listing_code,title,price,currency,city,district,area_m2,rooms,owner_id,listing_type,property_type')
    .eq('id', listingId).eq('status', 'moderation').maybeSingle()
  if (error) throw error
  if (!listing) return

  const item = listing as ListingSummary
  const [{ data: profile }, { data: images }] = await Promise.all([
    item.owner_id ? db.from('profiles').select('full_name,phone,company_name').eq('id', item.owner_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from('listing_images').select('image_url').eq('listing_id', listingId).order('sort_order', { ascending: true }).limit(1),
  ])
  const location = [item.city, item.district].filter(Boolean).join(', ') || 'Joylashuv ko‘rsatilmagan'
  const caption = [
    '🆕 ROYALHOUSE — YANGI E’LON',
    `🆔 ${item.listing_code || item.id}`,
    `🏠 ${item.title || 'Sarlavhasiz e’lon'}`,
    `💰 ${price(item.price, item.currency)}`,
    `📍 ${location}`,
    item.area_m2 != null ? `📐 ${item.area_m2} m²` : null,
    item.rooms != null ? `🚪 ${item.rooms} xona` : null,
    `👤 ${profile?.company_name || profile?.full_name || 'Foydalanuvchi'}`,
    profile?.phone ? `☎️ ${profile.phone}` : null,
    '',
    'Moderatsiya uchun tugmani tanlang.',
  ].filter(Boolean).join('\n')

  const keyboard = moderationKeyboard(item.id)
  const firstImage = images?.[0]?.image_url
  const destinations = [...new Set([groupId, ...moderatorIds()])]
  const results = await Promise.allSettled(destinations.map(chatId =>
    firstImage && /^https?:\/\//i.test(firstImage)
      ? telegram('sendPhoto', { chat_id: chatId, photo: firstImage, caption: caption.slice(0, 1000), reply_markup: keyboard })
      : telegram('sendMessage', { chat_id: chatId, text: caption, disable_web_page_preview: true, reply_markup: keyboard })
  ))
  const failures = results.filter(x => x.status === 'rejected')
  if (failures.length) console.warn('[moderation-bot] some moderator notifications failed', { listingId, failed: failures.length })
}

export async function notifyModerationResult(
  listingId: string,
  action: 'approve' | 'reject',
  actor: string,
  reason = '',
  excludeChatId?: number | string,
) {
  const token = process.env.TELEGRAM_MODERATION_BOT_TOKEN
  const groupId = process.env.ROYALHOUSE_MODERATION_GROUP_ID
  if (!token || !groupId) {
    console.warn('[moderation-bot] result notification skipped: token or group id is not configured')
    return
  }

  const db = serviceClient()
  const { data: listing, error } = await db.from('listings')
    .select('id,listing_code,title,price,currency,city,district,status')
    .eq('id', listingId).maybeSingle()
  if (error) throw error
  if (!listing) throw new Error('LISTING_NOT_FOUND_FOR_MODERATION_RESULT')

  const approved = action === 'approve'
  const message = [
    approved ? '✅ ROYALHOUSE — E’LON TASDIQLANDI' : '❌ ROYALHOUSE — E’LON RAD ETILDI',
    `🆔 ${listing.listing_code || listing.id}`,
    `🏠 ${listing.title || 'Sarlavhasiz e’lon'}`,
    `💰 ${price(listing.price, listing.currency)}`,
    `📍 ${[listing.city, listing.district].filter(Boolean).join(', ') || 'Joylashuv ko‘rsatilmagan'}`,
    `👤 Qaror qabul qilgan: ${actor || 'Noma’lum moderator'}`,
    `🕒 Vaqt: ${new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tashkent' }).format(new Date())}`,
    !approved && reason.trim() ? `📝 Rad etish sababi: ${reason.trim().slice(0, 1000)}` : null,
    approved ? 'Holat: Faol' : 'Holat: Tuzatish uchun qaytarildi',
    `🖥 ${SITE_URL}/admin/moderation`,
  ].filter(Boolean).join('\n')

  const destinations = [...new Set([groupId, ...moderatorIds()])]
    .filter(chatId => excludeChatId == null || String(chatId) !== String(excludeChatId))
  const results = await Promise.allSettled(destinations.map(chatId =>
    telegram('sendMessage', { chat_id: chatId, text: message, disable_web_page_preview: true })
  ))
  const failures = results.filter(result => result.status === 'rejected')
  if (failures.length) console.warn('[moderation-bot] moderation result notification failures', {
    listingId, action, failed: failures.length, destinations: destinations.length,
  })
}

export async function answerModerationCallback(callbackQueryId: string, text: string, alert = false) {
  await telegram('answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: alert })
}

export async function editModerationMessage(chatId: number | string, messageId: number, text: string) {
  await telegram('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })
  await telegram('sendMessage', { chat_id: chatId, text, reply_to_message_id: messageId, disable_web_page_preview: true })
}

export async function promptModerationRejection(chatId: number | string, messageId: number, listingId: string) {
  await telegram('sendMessage', {
    chat_id: chatId,
    text: `E’lonni rad etish sababini shu xabarga javob (Reply) qilib yozing. E’lon ID: ${listingId}`,
    reply_to_message_id: messageId,
    reply_markup: { force_reply: true, selective: true },
  })
}

export async function processModerationDecision(listingId: string, action: 'approve' | 'reject', reason: string, telegramUserId: string, sourceChatId?: number | string) {
  const allowed = moderatorIds()
  if (!allowed.includes(telegramUserId)) throw new Error('MODERATOR_NOT_ALLOWED')
  if (action === 'reject' && !reason.trim()) throw new Error('REJECTION_REASON_REQUIRED')

  const db = serviceClient()
  const now = new Date().toISOString()
  const nextStatus = action === 'approve' ? 'active' : 'draft'
  const patch = action === 'approve'
    ? { status: 'active', is_verified: true, published_at: now, moderation_note: null, moderation_updated_at: now, updated_at: now }
    : { status: 'draft', is_verified: false, published_at: null, moderation_note: reason.trim(), moderation_updated_at: now, updated_at: now }

  const { data: updated, error } = await db.from('listings').update(patch)
    .eq('id', listingId).eq('status', 'moderation')
    .select('id,listing_code,status,moderation_note').maybeSingle()
  if (error) throw error
  if (!updated) throw new Error('LISTING_ALREADY_MODERATED')

  const { error: historyError } = await db.from('listing_moderation_history').insert({
    listing_id: listingId, admin_id: null, moderator_telegram_id: telegramUserId, from_status: 'moderation',
    to_status: nextStatus, action, reason: reason.trim() || null, created_at: now,
  })
  if (historyError) console.error('[moderation-bot] moderation history insert failed', { listingId, error: historyError })

  await notifyModerationResult(
    listingId,
    action,
    `Telegram moderator (ID: ${telegramUserId})`,
    reason,
    sourceChatId,
  ).catch(notificationError => console.error('[moderation-bot] moderation result notification failed', { listingId, action, error: notificationError }))

  return updated
}
