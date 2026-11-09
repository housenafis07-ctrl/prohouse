import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { serviceClient } from '@/utils/admin/auth'

type TelegramUpdate = {
  message?: {
    text?: string
    chat?: { id?: number; type?: string }
    from?: { id?: number; username?: string; first_name?: string; last_name?: string; language_code?: string }
  }
}

type ShareListing = {
  id: string; title: string; description?: string | null; listing_type?: string | null; property_type?: string | null; price?: number | null; currency?: string | null; area_m2?: number | null; rooms?: number | null; floor?: number | null; floors_total?: number | null; district?: string | null; city?: string | null; address?: string | null; seller_name?: string | null
}
type ListingImage = { image_url: string; sort_order: number | null }
type ListingVideo = { provider: string; processed_storage_path: string | null; playback_url: string | null; thumbnail_storage_path: string | null; sort_order: number }

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz'

async function telegramApi(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
  const data = await response.json()
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram ${method} failed`)
  return data
}

async function sendTelegramMessage(chatId: string | number, text: string, includeMiniApp = false) {
  const body: Record<string, unknown> = { chat_id: chatId, text, disable_web_page_preview: true }
  if (includeMiniApp) body.reply_markup = { inline_keyboard: [[{ text: '🚀 Royalhouse’ni ochish', web_app: { url: `${SITE_URL}/telegram` } }]] }
  await telegramApi('sendMessage', body)
}

async function requestTelegramPhone(chatId: string | number) {
  await telegramApi('sendMessage', { chat_id: chatId, text: '🔐 Telegram ulanishini tasdiqlash uchun shu akkauntingizning telefon raqamini yuboring. Bu raqam Royalhouse shaxsiy kabinetingizdagi raqam bilan mos kelishi kerak.', reply_markup: { keyboard: [[{ text: '📱 Telefon raqamimni yuborish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } })
}

async function clearTelegramKeyboard(chatId: string | number) { await telegramApi('sendMessage', { chat_id: chatId, text: 'Tekshiruv yakunlandi.', reply_markup: { remove_keyboard: true } }) }

function normalizePhone(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('998') && digits.length === 12) return digits
  if (digits.length === 9) return `998${digits}`
  return digits
}
function formatPrice(price: number | null | undefined, currency: string | null | undefined) { if (price == null) return ''; const amount = new Intl.NumberFormat('uz-UZ').format(price); return `${amount} ${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'so‘m'}` }
function listingCaption(listing: ShareListing) {
  const lines = [
    `🏠 ${listing.title}`,
    listing.price != null ? `💰 ${formatPrice(listing.price, listing.currency)}` : null,
    [listing.city, listing.district, listing.address].filter(Boolean).join(', ') ? `📍 ${[listing.city, listing.district, listing.address].filter(Boolean).join(', ')}` : null,
    listing.area_m2 != null ? `📐 ${listing.area_m2} m²` : null,
    listing.rooms != null ? `🛏 ${listing.rooms} xona` : null,
    listing.floor != null ? `🏢 ${listing.floor}${listing.floors_total ? `/${listing.floors_total}` : ''} qavat` : null,
    listing.seller_name ? `👤 ${listing.seller_name}` : null,
    listing.description ? `\n${listing.description.replace(/\s+/g, ' ').trim().slice(0, 500)}` : null,
    `\n🔗 E’lonni ko‘rish: ${SITE_URL}/listings/${encodeURIComponent(listing.id)}`,
  ].filter(Boolean)
  return lines.join('\n')
}

async function getShareMedia(admin: ReturnType<typeof serviceClient>, listingId: string) {
  const [{ data: images, error: imagesError }, { data: videos, error: videosError }] = await Promise.all([
    admin.from('listing_images').select('image_url,sort_order').eq('listing_id', listingId).order('sort_order', { ascending: true }),
    admin.from('listing_media').select('provider,processed_storage_path,playback_url,thumbnail_storage_path,sort_order').eq('listing_id', listingId).eq('media_type', 'video').eq('status', 'ready').order('sort_order', { ascending: true }).limit(1),
  ])
  if (imagesError) throw imagesError
  if (videosError) throw videosError
  const publicImages = ((images || []) as ListingImage[]).map(image => image.image_url).filter(url => /^https?:\/\//i.test(url))
  const media: Array<{ type: 'photo' | 'video'; media: string }> = publicImages.map(media => ({ type: 'photo', media }))
  const video = (videos || [])[0] as ListingVideo | undefined
  if (video) {
    let videoUrl = video.playback_url || ''
    if (video.provider === 'cloudflare' && video.processed_storage_path) videoUrl = `https://videodelivery.net/${video.processed_storage_path}/downloads/default.mp4`
    else if (video.provider === 'supabase' && video.processed_storage_path) { const { data: signed, error } = await admin.storage.from('listing-videos').createSignedUrl(video.processed_storage_path, 60 * 60); if (!error && signed?.signedUrl) videoUrl = signed.signedUrl }
    if (/^https?:\/\//i.test(videoUrl)) media.push({ type: 'video', media: videoUrl })
  }
  return media
}

async function sendListingShare(chatId: string | number, listingId: string) {
  const admin = serviceClient()
  const { data: listing, error } = await admin.from('listings').select('id,title,description,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,address,seller_name').eq('id', listingId).eq('status', 'active').maybeSingle()
  if (error) throw error
  if (!listing) { await sendTelegramMessage(chatId, 'Bu e’lon hozir mavjud emas yoki faol emas.'); return }
  const media = await getShareMedia(admin, listingId); const caption = listingCaption(listing as ShareListing)
  if (!media.length) { await telegramApi('sendMessage', { chat_id: chatId, text: caption, disable_web_page_preview: false, reply_markup: { inline_keyboard: [[{ text: '🏠 E’lonni ochish', url: `${SITE_URL}/listings/${encodeURIComponent(listingId)}` }]] } }); return }
  if (media.length === 1) { const item = media[0]; await telegramApi(item.type === 'video' ? 'sendVideo' : 'sendPhoto', { chat_id: chatId, [item.type === 'video' ? 'video' : 'photo']: item.media, caption }); return }
  const chunks: Array<typeof media> = []; for (let i = 0; i < media.length; i += 10) chunks.push(media.slice(i, i + 10))
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex]; const items = chunk.map((item, index) => ({ type: item.type, media: item.media, ...(chunkIndex === 0 && index === 0 ? { caption } : {}) }))
    try { await telegramApi('sendMediaGroup', { chat_id: chatId, media: items }) } catch (error) {
      if (chunk.some(item => item.type === 'video')) { const photosOnly = chunk.filter(item => item.type === 'photo'); if (photosOnly.length) await telegramApi('sendMediaGroup', { chat_id: chatId, media: photosOnly.map((item, index) => ({ type: 'photo', media: item.media, ...(chunkIndex === 0 && index === 0 ? { caption } : {}) })) }) } else throw error
    }
  }
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret && request.headers.get('x-telegram-bot-api-secret-token') !== expectedSecret) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const update = (await request.json()) as TelegramUpdate
    const message = update.message; const text = String(message?.text || '').trim(); const chatId = message?.chat?.id
    if (!message || !chatId) return NextResponse.json({ ok: true })
    const from = message.from; const admin = serviceClient(); const telegramUserId = from?.id ? String(from.id) : ''

    // Register the Telegram chat for bot notifications only. This does not create or authenticate a RoyalHouse account.
    if (from?.id && message.chat?.type === 'private') {
      const { data: existingLink, error: linkLookupError } = await admin.from('telegram_user_links').select('profile_id').eq('telegram_user_id', telegramUserId).maybeSingle()
      if (linkLookupError) throw linkLookupError
      const { error: botUserError } = await admin.from('telegram_bot_users').upsert({ telegram_user_id: telegramUserId, chat_id: String(chatId), profile_id: existingLink?.profile_id || null, username: from.username || null, first_name: from.first_name || null, last_name: from.last_name || null, language_code: from.language_code || null, is_active: true, blocked_at: null, last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'telegram_user_id' })
      if (botUserError) throw botUserError
    }

    if (message.contact) {
      if (!from?.id || !telegramUserId || message.contact.user_id !== from.id) {
        await sendTelegramMessage(chatId, '❌ Iltimos, aynan shu Telegram akkauntingizning o‘z kontaktini yuboring.')
        return NextResponse.json({ ok: true })
      }

      const { data: pendingTokens, error: pendingTokenError } = await admin.from('telegram_link_tokens')
        .select('token_hash,profile_id,auth_user_id,expires_at,used_at,telegram_user_id')
        .eq('telegram_user_id', telegramUserId).is('used_at', null)
        .not('contact_requested_at', 'is', null)
        .gt('expires_at', new Date().toISOString())
        .order('contact_requested_at', { ascending: false }).limit(1)
      if (pendingTokenError) throw pendingTokenError
      const token = pendingTokens?.[0]
      if (!token || !token.profile_id) {
        await clearTelegramKeyboard(chatId)
        await sendTelegramMessage(chatId, 'Ulash jarayoni topilmadi yoki muddati tugagan. RoyalHouse Mini App’dan qayta boshlang.')
        return NextResponse.json({ ok: true })
      }

      const phoneDigits = normalizePhone(message.contact.phone_number)
      if (!/^998\d{9}$/.test(phoneDigits)) {
        await sendTelegramMessage(chatId, '❌ O‘zbekiston telefon raqamini yuboring.')
        return NextResponse.json({ ok: true })
      }
      const normalizedPhone = `+${phoneDigits}`
      const { error: contactPhoneError } = await admin.from('telegram_link_tokens')
        .update({ contact_phone: normalizedPhone })
        .eq('token_hash', token.token_hash).is('used_at', null)
      if (contactPhoneError) throw contactPhoneError
      const { data: profile, error: profileError } = token.profile_id
        ? await admin.from('profiles').select('id,phone').eq('id', token.profile_id).maybeSingle()
        : await admin.from('profiles').select('id,phone').eq('phone', normalizedPhone).maybeSingle()
      if (profileError) throw profileError

      if (token.profile_id && (!profile?.id || normalizePhone(profile.phone) !== phoneDigits)) {
        await clearTelegramKeyboard(chatId)
        await sendTelegramMessage(chatId, '❌ Yuborilgan telefon raqami ushbu RoyalHouse profiliga mos kelmadi. Profilingizdagi raqamni yuboring.')
        return NextResponse.json({ ok: true })
      }

      if (profile?.id) {
        if (!token.profile_id) {
          const { data: boundToken, error: tokenBindError } = await admin.from('telegram_link_tokens')
            .update({ profile_id: profile.id, auth_user_id: profile.id })
            .eq('token_hash', token.token_hash).is('profile_id', null).is('used_at', null)
            .select('token_hash').maybeSingle()
          if (tokenBindError) throw tokenBindError
          if (!boundToken) {
            await clearTelegramKeyboard(chatId)
            await sendTelegramMessage(chatId, '❌ Bu ulash jarayoni boshqa so‘rovda ishlatilgan. Mini App’dan qayta boshlang.')
            return NextResponse.json({ ok: true })
          }
        }

        const { error: claimError } = await admin.from('phone_verification_claims').upsert({
          phone: normalizedPhone,
          verified_at: new Date().toISOString(),
          verification_method: 'telegram_contact',
        }, { onConflict: 'phone' })
        if (claimError) throw claimError

        const { error: linkError } = await admin.rpc('link_telegram_identity', {
          p_profile_id: profile.id,
          p_telegram_user_id: telegramUserId,
          p_chat_id: String(chatId),
          p_telegram_username: from.username || null,
          p_linked_at: new Date().toISOString(),
        })
        if (linkError) {
          const reason = linkError.message || ''
          await clearTelegramKeyboard(chatId)
          if (reason.includes('ALREADY_LINKED')) {
            await sendTelegramMessage(chatId, '❌ Bu Telegram yoki RoyalHouse profili boshqa akkauntga ulangan. Avtomatik birlashtirish mumkin emas. Yordam xizmatiga murojaat qiling.')
            return NextResponse.json({ ok: true })
          }
          throw linkError
        }

        const { error: usedError } = await admin.from('telegram_link_tokens')
          .update({ used_at: new Date().toISOString() }).eq('token_hash', token.token_hash).is('used_at', null)
        if (usedError) throw usedError
        await clearTelegramKeyboard(chatId)
        await sendTelegramMessage(chatId, '✅ Telefon raqamingiz bo‘yicha mavjud RoyalHouse profilingiz topildi va Telegram akkauntingiz unga ulandi. Mini App’ni qayta ochishingiz mumkin.', true)
        return NextResponse.json({ ok: true })
      }

      await clearTelegramKeyboard(chatId)
      await sendTelegramMessage(chatId, '❌ RoyalHouse profili topilmadi. Avval sayt yoki ilovada telefon raqamingizni SMS OTP orqali tasdiqlang.')
      return NextResponse.json({ ok: true })
    }

    if (!text) return NextResponse.json({ ok: true })
    if (text.startsWith('/start')) {
      const payload = text.split(/\s+/, 2)[1] || ''
      if (!payload) {
        const ru = (from?.language_code || '').toLowerCase().startsWith('ru')
        const intro = ru
          ? '🏠 Добро пожаловать в RoyalHouse!\n\nRoyalHouse — платформа недвижимости для поиска жилья, размещения объявлений, управления своими объявлениями и ипотечных сервисов.'
          : '🏠 RoyalHouse’ga xush kelibsiz!\n\nRoyalHouse — uy-joy platformasi: uy, kvartira va dachalarni topish, e’lon joylashtirish, e’lonlarni boshqarish va ipoteka xizmatlaridan foydalanish mumkin.'
        const guide = ru
          ? '📱 Как пользоваться RoyalHouse?\n\n1️⃣ Нажмите «Royalhouse’ni ochish», чтобы открыть мини-приложение.\n\n2️⃣ Найдите нужный дом, квартиру или дачу.\n\n3️⃣ Чтобы разместить объявление, выберите «E’lon joylashtirish».\n\n4️⃣ В личном кабинете можно управлять объявлениями, смотреть статистику, продвигать объявления и настраивать профиль.\n\n5️⃣ Вход и регистрация доступны только по номеру телефона и SMS-коду OTP.\n\n🔐 Политика конфиденциальности — по кнопке ниже.'
          : '📱 RoyalHouse’dan qanday foydalaniladi?\n\n1️⃣ «Royalhouse’ni ochish» tugmasini bosing — Mini App ochiladi.\n\n2️⃣ Kerakli uy, kvartira yoki dachani qidiring.\n\n3️⃣ E’lon joylashtirish uchun «E’lon joylashtirish» bo‘limini tanlang.\n\n4️⃣ Shaxsiy kabinetda e’lonlarni boshqaring, statistika ko‘rsatkichlarini ko‘ring, e’lonlarni ilgari suring va profilingizni sozlang.\n\n5️⃣ Kirish va ro‘yxatdan o‘tish faqat telefon raqami va SMS OTP kodi orqali amalga oshiriladi.\n\n🔐 Maxfiylik siyosati bilan quyidagi tugma orqali tanishishingiz mumkin.'
        await sendTelegramMessage(chatId, intro)
        await telegramApi('sendMessage', {
          chat_id: chatId,
          text: guide,
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 Royalhouse’ni ochish', web_app: { url: `${SITE_URL}/telegram` } }],
              [{ text: ru ? '🔐 Политика конфиденциальности' : '🔐 Maxfiylik siyosati', url: `${SITE_URL}/privacy` }],
            ],
          },
        })
        return NextResponse.json({ ok: true })
      }
      if (payload.startsWith('share_')) { const listingId = payload.slice(6); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) { await sendTelegramMessage(chatId, 'E’lon ulashish havolasi noto‘g‘ri.'); return NextResponse.json({ ok: true }) }; await sendListingShare(chatId, listingId); return NextResponse.json({ ok: true }) }
      if (!from?.id) { await sendTelegramMessage(chatId, 'Telegram foydalanuvchisi aniqlanmadi. Saytdan yangi ulash havolasini oling.'); return NextResponse.json({ ok: true }) }
      const rawToken = payload.slice(5); if (!/^[a-f0-9]{48}$/i.test(rawToken)) { await sendTelegramMessage(chatId, 'Ulash havolasi noto‘g‘ri. RoyalHouse shaxsiy kabinetidan yangi ulash havolasi oling.'); return NextResponse.json({ ok: true }) }
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      const { data: token, error: tokenError } = await admin.from('telegram_link_tokens').select('profile_id,auth_user_id,expires_at,used_at,telegram_user_id').eq('token_hash', tokenHash).maybeSingle(); if (tokenError) throw tokenError
      if (!token || token.used_at || new Date(token.expires_at).getTime() <= Date.now()) { await sendTelegramMessage(chatId, 'Ulash havolasi eskirgan yoki ishlatilgan. RoyalHouse shaxsiy kabinetidan yangi havola yarating.'); return NextResponse.json({ ok: true }) }
      if (token.telegram_user_id && token.telegram_user_id !== telegramUserId) { await sendTelegramMessage(chatId, '❌ Bu ulash havolasi boshqa Telegram akkauntida boshlangan. RoyalHouse shaxsiy kabinetidan yangi ulash havolasini oling.'); return NextResponse.json({ ok: true }) }
      if (!token.telegram_user_id) { const { data: claimedToken, error: claimError } = await admin.from('telegram_link_tokens').update({ telegram_user_id: telegramUserId, contact_requested_at: new Date().toISOString() }).eq('token_hash', tokenHash).is('telegram_user_id', null).is('used_at', null).select('token_hash').maybeSingle(); if (claimError) throw claimError; if (!claimedToken) { await sendTelegramMessage(chatId, '❌ Ulash havolasi boshqa Telegram akkauntida boshlangan. RoyalHouse shaxsiy kabinetidan yangi havola oling.'); return NextResponse.json({ ok: true }) } }
      else { const { error: stampError } = await admin.from('telegram_link_tokens').update({ contact_requested_at: new Date().toISOString() }).eq('token_hash', tokenHash).is('used_at', null); if (stampError) throw stampError }
      await requestTelegramPhone(chatId); return NextResponse.json({ ok: true })
    }

    const name = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim()
    const { error: supportError } = await admin.from('support_messages').insert({ name: name || null, subject: 'Telegram murojaati', message: text.slice(0, 5000), source: 'telegram', telegram_user_id: String(from?.id || chatId), telegram_username: from?.username ? '@' + from.username : null })
    if (supportError) { console.error('telegram support insert failed', supportError); return NextResponse.json({ error: 'Database error' }, { status: 500 }) }
    await sendTelegramMessage(chatId, 'Xabaringiz RoyalHouse qo‘llab-quvvatlash xizmatiga yuborildi.', true); return NextResponse.json({ ok: true })
  } catch (error) { console.error('telegram webhook failed', error); return NextResponse.json({ error: 'Telegram webhook failed' }, { status: 500 }) }
}
