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
  seller_type?: string | null
  seller_role?: string | null
}

const SITE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')

async function moderatorDestinations(db: ReturnType<typeof serviceClient>, groupId: string) {
  const { data: rows, error } = await db.from('telegram_moderators')
    .select('telegram_user_id,chat_id,is_active')
  if (error) throw error
  const knownIds = new Set((rows || []).map(row => row.telegram_user_id))
  const activeChats = (rows || []).filter(row => row.is_active && row.chat_id).map(row => row.chat_id)
  // Keep pre-existing environment-configured moderators working during the
  // transition, but only until they are registered in the database.
  const legacyChats = (process.env.ROYALHOUSE_MODERATOR_TELEGRAM_IDS || '')
    .split(',').map(value => value.trim()).filter(value => /^\d+$/.test(value) && !knownIds.has(value))
  return [...new Set([groupId, ...activeChats, ...legacyChats])]
}

async function canModerate(db: ReturnType<typeof serviceClient>, telegramUserId: string) {
  const { data, error } = await db.from('telegram_moderators')
    .select('is_active').eq('telegram_user_id', telegramUserId).maybeSingle()
  if (error) throw error
  if (data) return data.is_active === true
  return (process.env.ROYALHOUSE_MODERATOR_TELEGRAM_IDS || '')
    .split(',').map(value => value.trim()).includes(telegramUserId)
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
    throw new Error('TELEGRAM_MODERATION_BOT_TOKEN_OR_GROUP_ID_NOT_CONFIGURED')
  }

  const db = serviceClient()
  const { data: listing, error } = await db.from('listings')
    .select('id,listing_code,title,price,currency,city,district,area_m2,rooms,owner_id,listing_type,property_type,seller_type,seller_role')
    .eq('id', listingId).eq('status', 'moderation').maybeSingle()
  if (error) throw error
  if (!listing) return

  const item = listing as ListingSummary
  const [{ data: profile }, { data: images }] = await Promise.all([
    item.owner_id ? db.from('profiles').select('full_name,phone,company_name').eq('id', item.owner_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from('listing_images').select('image_url').eq('listing_id', listingId).order('sort_order', { ascending: true }).limit(1),
  ])
  const location = [item.city, item.district].filter(Boolean).join(', ') || 'Joylashuv ko‘rsatilmagan'
  const sellerLabel = item.seller_role === 'realtor' || item.seller_type === 'realtor'
    ? 'Rieltor'
    : item.seller_role === 'developer' || item.seller_type === 'developer'
      ? 'Developer'
      : item.seller_type === 'service_provider'
        ? 'Xizmat ko‘rsatuvchi hamkor'
        : item.seller_type === 'seller'
          ? 'Hamkor / sotuvchi'
          : 'Jismoniy shaxs yoki mulk egasi'
  const caption = [
    '🆕 ROYALHOUSE — YANGI E’LON',
    `🆔 ${item.listing_code || item.id}`,
    `🏠 ${item.title || 'Sarlavhasiz e’lon'}`,
    `💰 ${price(item.price, item.currency)}`,
    `📍 ${location}`,
    item.area_m2 != null ? `📐 ${item.area_m2} m²` : null,
    item.rooms != null ? `🚪 ${item.rooms} xona` : null,
    `🏷 E’lon beruvchi turi: ${sellerLabel}`,
    `👤 ${profile?.company_name || profile?.full_name || 'Foydalanuvchi'}`,
    profile?.phone ? `☎️ ${profile.phone}` : null,
    '',
    'Moderatsiya uchun tugmani tanlang.',
  ].filter(Boolean).join('\n')

  const keyboard = moderationKeyboard(item.id)
  const firstImage = images?.[0]?.image_url
  const destinations = await moderatorDestinations(db, groupId)
  const results = await Promise.allSettled(destinations.map(chatId =>
    firstImage && /^https?:\/\//i.test(firstImage)
      ? telegram('sendPhoto', { chat_id: chatId, photo: firstImage, caption: caption.slice(0, 1000), reply_markup: keyboard })
      : telegram('sendMessage', { chat_id: chatId, text: caption, disable_web_page_preview: true, reply_markup: keyboard })
  ))
  const failures = results.filter(x => x.status === 'rejected')
  const delivery = { sent: results.length - failures.length, failed: failures.length, destinations: destinations.length }
  if (failures.length) {
    console.error('[moderation-bot] some moderator notifications failed', {
      listingId,
      delivery,
      errors: failures.map(result => result.status === 'rejected' ? String(result.reason) : ''),
    })
  }
  if (delivery.sent === 0) throw new Error('TELEGRAM_NOTIFICATION_DELIVERY_FAILED')
  return delivery
}


export async function notifyModeratorsAboutDeveloperComplex(complexId: string) {
  const token = process.env.TELEGRAM_MODERATION_BOT_TOKEN
  const groupId = process.env.ROYALHOUSE_MODERATION_GROUP_ID
  if (!token || !groupId) throw new Error('TELEGRAM_MODERATION_BOT_TOKEN_OR_GROUP_ID_NOT_CONFIGURED')

  const db = serviceClient()
  const { data: complex, error } = await db.from('residential_complexes')
    .select('id,name,city,address,description,completion_year,developer_id,moderation_status')
    .eq('id', complexId)
    .eq('moderation_status', 'pending')
    .maybeSingle()
  if (error) throw error
  if (!complex) throw new Error('DEVELOPER_COMPLEX_NOT_PENDING')

  const { data: developer, error: developerError } = await db.from('developer_profiles')
    .select('company_name,brand_name,partner_profile_id')
    .eq('id', complex.developer_id)
    .maybeSingle()
  if (developerError) throw developerError

  const { data: partner } = developer?.partner_profile_id
    ? await db.from('partner_profiles').select('user_id,company_name').eq('id', developer.partner_profile_id).maybeSingle()
    : { data: null }
  const { data: profile } = partner?.user_id
    ? await db.from('profiles').select('full_name,phone,company_name').eq('id', partner.user_id).maybeSingle()
    : { data: null }

  const { count: buildingsCount } = await db.from('residential_buildings')
    .select('id', { count: 'exact', head: true }).eq('complex_id', complexId)
  const { data: buildings } = await db.from('residential_buildings').select('id').eq('complex_id', complexId)
  const buildingIds = (buildings || []).map(item => item.id)
  const { count: unitsCount } = buildingIds.length
    ? await db.from('complex_units').select('id', { count: 'exact', head: true }).in('building_id', buildingIds)
    : { count: 0 }

  const message = [
    '🏗 ROYALHOUSE — DEVELOPER LOYIHASI MODERATSIYADA',
    `🏢 Majmua: ${complex.name}`,
    `📍 ${[complex.city, complex.address].filter(Boolean).join(', ') || 'Manzil ko‘rsatilmagan'}`,
    complex.completion_year ? `📅 Topshirish yili: ${complex.completion_year}` : null,
    `🏬 Korpuslar: ${buildingsCount ?? 0}`,
    `🏠 Xonadonlar: ${unitsCount ?? 0}`,
    `🏢 Developer: ${developer?.brand_name || developer?.company_name || partner?.company_name || profile?.company_name || 'Noma’lum kompaniya'}`,
    profile?.full_name ? `👤 Mas’ul: ${profile.full_name}` : null,
    profile?.phone ? `☎️ ${profile.phone}` : null,
    '',
    `🖥 ${SITE_URL}/admin/developer-complexes`,
  ].filter(Boolean).join('\n')

  const destinations = [...new Set([groupId, ...moderatorIds()])]
  const results = await Promise.allSettled(destinations.map(chatId =>
    telegram('sendMessage', { chat_id: chatId, text: message, disable_web_page_preview: true })
  ))
  const failures = results.filter(result => result.status === 'rejected')
  const delivery = { sent: results.length - failures.length, failed: failures.length, destinations: destinations.length }
  if (failures.length) console.error('[moderation-bot] developer complex notification failures', {
    complexId, delivery,
    errors: failures.map(result => result.status === 'rejected' ? String(result.reason) : ''),
  })
  if (delivery.sent === 0) throw new Error('TELEGRAM_DEVELOPER_COMPLEX_NOTIFICATION_FAILED')
  return delivery
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
  const db = serviceClient()
  if (!await canModerate(db, telegramUserId)) throw new Error('MODERATOR_NOT_ALLOWED')
  if (action === 'reject' && !reason.trim()) throw new Error('REJECTION_REASON_REQUIRED')
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
    listing_id: listingId, admin_user_id: null, moderator_telegram_id: telegramUserId, from_status: 'moderation',
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
