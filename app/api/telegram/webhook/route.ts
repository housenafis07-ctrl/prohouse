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

type ShareListing = {
  id: string
  title: string
  description?: string | null
  listing_type?: string | null
  property_type?: string | null
  price?: number | null
  currency?: string | null
  area_m2?: number | null
  rooms?: number | null
  floor?: number | null
  floors_total?: number | null
  district?: string | null
  city?: string | null
  address?: string | null
  seller_name?: string | null
}

type ListingImage = { image_url: string; sort_order: number | null }
type ListingVideo = {
  provider: string
  processed_storage_path: string | null
  playback_url: string | null
  thumbnail_storage_path: string | null
  sort_order: number
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz'

async function telegramApi(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await response.json()
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram ${method} failed`)
  return data
}

async function sendTelegramMessage(chatId: string | number, text: string, includeMiniApp = false) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  }
  if (includeMiniApp) {
    body.reply_markup = {
      inline_keyboard: [[
        { text: '🚀 Royalhouse’ni ochish', web_app: { url: SITE_URL } },
      ]],
    }
  }
  await telegramApi('sendMessage', body)
}

function formatPrice(price: number | null | undefined, currency: string | null | undefined) {
  if (price == null) return ''
  const amount = new Intl.NumberFormat('uz-UZ').format(price)
  return `${amount} ${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'so‘m'}`
}

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
    if (video.provider === 'cloudflare' && video.processed_storage_path) {
      videoUrl = `https://videodelivery.net/${video.processed_storage_path}/downloads/default.mp4`
    } else if (video.provider === 'supabase' && video.processed_storage_path) {
      const { data: signed, error } = await admin.storage.from('listing-videos').createSignedUrl(video.processed_storage_path, 60 * 60)
      if (!error && signed?.signedUrl) videoUrl = signed.signedUrl
    }
    if (/^https?:\/\//i.test(videoUrl)) media.push({ type: 'video', media: videoUrl })
  }

  return media
}

async function sendListingShare(chatId: string | number, listingId: string) {
  const admin = serviceClient()
  const { data: listing, error } = await admin
    .from('listings')
    .select('id,title,description,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,address,seller_name')
    .eq('id', listingId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  if (!listing) {
    await sendTelegramMessage(chatId, 'Bu e’lon hozir mavjud emas yoki faol emas.')
    return
  }

  const media = await getShareMedia(admin, listingId)
  const caption = listingCaption(listing as ShareListing)

  if (!media.length) {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: caption,
      disable_web_page_preview: false,
      reply_markup: {
        inline_keyboard: [[{ text: '🏠 E’lonni ochish', url: `${SITE_URL}/listings/${encodeURIComponent(listingId)}` }]],
      },
    })
    return
  }

  const chunks: Array<typeof media> = []
  for (let i = 0; i < media.length; i += 10) chunks.push(media.slice(i, i + 10))

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex]
    const items = chunk.map((item, index) => ({
      type: item.type,
      media: item.media,
      ...(chunkIndex === 0 && index === 0 ? { caption } : {}),
    }))
    try {
      await telegramApi('sendMediaGroup', { chat_id: chatId, media: items })
    } catch (error) {
      if (chunk.some(item => item.type === 'video')) {
        const photosOnly = chunk.filter(item => item.type === 'photo')
        if (photosOnly.length) {
          const photoItems = photosOnly.map((item, index) => ({
            type: 'photo',
            media: item.media,
            ...(chunkIndex === 0 && index === 0 ? { caption } : {}),
          }))
          await telegramApi('sendMediaGroup', { chat_id: chatId, media: photoItems })
        }
      } else {
        throw error
      }
    }
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

    const from = message.from
    const admin = serviceClient()

    if (text.startsWith('/start')) {
      const payload = text.split(/\s+/, 2)[1] || ''

      if (payload.startsWith('share_')) {
        const listingId = payload.slice(6)
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) {
          await sendTelegramMessage(chatId, 'E’lon ulashish havolasi noto‘g‘ri.')
          return NextResponse.json({ ok: true })
        }
        await sendListingShare(chatId, listingId)
        return NextResponse.json({ ok: true })
      }

      if (!payload.startsWith('link_')) {
        await sendTelegramMessage(
          chatId,
          'Assalomu alaykum! Royalhouse’da uy qidiring, e’lon joylang va bronlarni boshqaring. Telegram orqali avtomatik kirish mumkin — SMS kod kerak emas.',
          true,
        )
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
      const { data: token, error: tokenError } = await admin
        .from('telegram_link_tokens')
        .select('profile_id,expires_at,used_at')
        .eq('token_hash', tokenHash)
        .maybeSingle()
      if (tokenError) throw tokenError
      if (!token || token.used_at || new Date(token.expires_at).getTime() <= Date.now()) {
        await sendTelegramMessage(chatId, 'Ulash havolasi eskirgan yoki ishlatilgan. Royalhouse shaxsiy kabinetidan yangi havola yarating.')
        return NextResponse.json({ ok: true })
      }

      const telegramUserId = String(from.id)

      const { data: existingTelegramLink, error: existingTelegramLinkError } = await admin
        .from('telegram_user_links')
        .select('profile_id')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle()
      if (existingTelegramLinkError) throw existingTelegramLinkError

      const { data: existingProfileLink, error: existingProfileLinkError } = await admin
        .from('telegram_user_links')
        .select('telegram_user_id')
        .eq('profile_id', token.profile_id)
        .maybeSingle()
      if (existingProfileLinkError) throw existingProfileLinkError

      if (existingTelegramLink?.profile_id && existingTelegramLink.profile_id !== token.profile_id) {
        if (existingProfileLink?.telegram_user_id && existingProfileLink.telegram_user_id !== telegramUserId) {
          await sendTelegramMessage(chatId, 'Bu Royalhouse profili allaqachon boshqa Telegram akkauntiga ulangan. Avval mavjud Telegram ulanishini uzing.')
          return NextResponse.json({ ok: true })
        }

        const { error: rebindError } = await admin
          .from('telegram_user_links')
          .update({
            profile_id: token.profile_id,
            chat_id: String(chatId),
            telegram_username: from.username || null,
            linked_at: new Date().toISOString(),
          })
          .eq('telegram_user_id', telegramUserId)

        if (rebindError) throw rebindError
      } else {
        if (existingProfileLink?.telegram_user_id && existingProfileLink.telegram_user_id !== telegramUserId) {
          await sendTelegramMessage(chatId, 'Bu Royalhouse profili allaqachon boshqa Telegram akkauntiga ulangan. Avval mavjud Telegram ulanishini uzing.')
          return NextResponse.json({ ok: true })
        }

        const { error: linkError } = await admin.from('telegram_user_links').upsert({
          profile_id: token.profile_id,
          telegram_user_id: telegramUserId,
          chat_id: String(chatId),
          telegram_username: from.username || null,
          linked_at: new Date().toISOString(),
        }, { onConflict: 'profile_id' })
        if (linkError) throw linkError
      }

      const { error: usedError } = await admin
        .from('telegram_link_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token_hash', tokenHash)
        .is('used_at', null)
      if (usedError) throw usedError

      await sendTelegramMessage(chatId, '✅ Telegram akkauntingiz Royalhouse profiliga ulandi! Endi Royalhouse’ni shu yerdan bir bosishda ochishingiz mumkin.', true)
      return NextResponse.json({ ok: true })
    }

    const name = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim()
    const { error: supportError } = await admin.from('support_messages').insert({
      name: name || null,
      subject: 'Telegram murojaati',
      message: text.slice(0, 5000),
      source: 'telegram',
      telegram_user_id: String(from?.id || chatId),
      telegram_username: from?.username ? '@' + from.username : null,
    })
    if (supportError) {
      console.error('telegram support insert failed', supportError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    await sendTelegramMessage(chatId, 'Xabaringiz Royalhouse qo‘llab-quvvatlash xizmatiga yuborildi.', true)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('telegram webhook failed', error)
    return NextResponse.json({ error: 'Telegram webhook failed' }, { status: 500 })
  }
}
