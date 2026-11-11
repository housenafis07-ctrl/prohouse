import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const TELEGRAM_API = 'https://api.telegram.org'
const TELEGRAM_MEDIA_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/telegram-media/`
const MARKETING_CHANNEL_CHAT_ID = process.env.TELEGRAM_MARKETING_CHANNEL_ID || ''

type Audience = 'all' | 'buyers' | 'listings' | 'realtors' | 'trusted'
type MediaType = 'image' | 'video'
type Destination = 'bot' | 'channel'

function parseTashkentDateTime(value: unknown): Date | null {
  const raw = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return null
  const parsed = new Date(raw + ':00+05:00')
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function botToken() { return process.env.TELEGRAM_BOT_TOKEN || process.env.ROYALHOUSE_TELEGRAM_BOT_TOKEN || '' }

async function telegram(method: string, body: Record<string, unknown>) {
  const token = botToken()
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN sozlanmagan')
  const r = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
  const data = await r.json()
  if (!r.ok || !data.ok) throw new Error(data.description || 'Telegram API xatosi')
  return data.result
}

function validateMedia(mediaUrl: string, mediaType: string) {
  if (!mediaUrl) return null
  if (!TELEGRAM_MEDIA_PREFIX || !mediaUrl.startsWith(TELEGRAM_MEDIA_PREFIX)) throw new Error('Media manzili RoyalHouse Telegram storage manzilidan bo‘lishi kerak.')
  if (mediaType !== 'image' && mediaType !== 'video') throw new Error('Noto‘g‘ri media turi.')
  return mediaType as MediaType
}

function caption(title: string, message: string) { return `<b>${escapeHtml(title)}</b>

${escapeHtml(message)}` }

async function sendCampaignMessage(chatId: string, title: string, message: string, buttonText: string, buttonUrl: string, mediaUrl: string, mediaType: MediaType | null) {
  const text = caption(title, message)
  const replyMarkup = buttonText && buttonUrl ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] } : undefined
  if (!mediaUrl || !mediaType) return telegram('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...(replyMarkup ? { reply_markup: replyMarkup } : {}) })

  const mediaCaption = text.slice(0, 1024)
  const result = await telegram(mediaType === 'image' ? 'sendPhoto' : 'sendVideo', {
    chat_id: chatId,
    [mediaType === 'image' ? 'photo' : 'video']: mediaUrl,
    caption: mediaCaption,
    parse_mode: 'HTML',
    show_caption_above_media: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
  if (text.length > 1024) await telegram('sendMessage', { chat_id: chatId, text: text.slice(1024), parse_mode: 'HTML' })
  return result
}

export async function GET() {
  const { error: authError } = await requireAdmin('listings.moderate')
  if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })
  const supabase = serviceClient()
  const modern = await supabase.from('telegram_broadcast_campaigns')
    .select('id,title,audience,status,sent_count,failed_count,media_url,media_type,media_name,created_at,destination,recipient_count,delivered_count,scheduled_at,scheduled_timezone')
    .order('created_at', { ascending: false }).limit(50)
  const schemaReady = !modern.error
  const legacy = schemaReady ? null : await supabase.from('telegram_broadcast_campaigns')
    .select('id,title,audience,status,sent_count,failed_count,media_url,media_type,media_name,created_at')
    .order('created_at', { ascending: false }).limit(50)
  const campaigns = schemaReady ? modern.data : legacy?.data
  const campaignsError = schemaReady ? modern.error : legacy?.error
  const [{ data: counts, error: countsError }, { data: eligibleCount, error: eligibleCountError }] = await Promise.all([
    supabase.rpc('get_telegram_broadcast_audience_counts'),
    supabase.rpc('get_telegram_marketing_eligible_count'),
  ])
  if (campaignsError) return NextResponse.json({ error: campaignsError.message }, { status: 500 })
  if (countsError) return NextResponse.json({ error: countsError.message }, { status: 500 })
  const audienceCounts = Object.fromEntries((counts || []).map((row: { audience: string; count: number | string }) => [row.audience, Number(row.count)]))
  const optedInCount = eligibleCountError ? 0 : Number(eligibleCount || 0)
  const rows = (campaigns || []).map((item: any) => ({ ...item, destination: item.destination || 'bot' }))
  const totalSent = rows.reduce((sum: number, item: any) => sum + Number(item.sent_count || 0), 0)
  const totalFailed = rows.reduce((sum: number, item: any) => sum + Number(item.failed_count || 0), 0)
  const channelCampaigns = rows.filter((item: any) => item.destination === 'channel')
  return NextResponse.json({
    campaigns: rows, audienceCounts,
    schemaReady: schemaReady && !eligibleCountError,
    schemaNotice: schemaReady && !eligibleCountError ? null : 'Marketing migratsiyalari ushbu Supabase bazasida hali qo‘llanmagan. Tarix ko‘rinadi, lekin ommaviy yuborish xavfsizlik uchun vaqtincha o‘chirilgan.',
    stats: { optedInUsers: optedInCount, campaigns: rows.length, sent: totalSent, failed: totalFailed, channelPosts: channelCampaigns.length, botCampaigns: rows.filter((item: any) => item.destination !== 'channel').length },
  })
}

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin('listings.moderate')
  if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })
  const supabase = serviceClient()
  const body = await req.json()
  const action = body.action === 'test' || body.action === 'test_client' ? 'test_client' : body.action === 'schedule' ? 'schedule' : body.action === 'cancel' ? 'cancel' : 'broadcast'
  if (action === 'cancel') {
    const campaignId = String(body.campaignId || '').trim()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) return NextResponse.json({ error: 'Kampaniya ID noto‘g‘ri.' }, { status: 400 })
    const { data: cancelled, error: cancelError } = await supabase.from('telegram_broadcast_campaigns')
      .update({ status: 'cancelled' }).eq('id', campaignId).eq('status', 'queued').select('id').maybeSingle()
    if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 500 })
    if (!cancelled) return NextResponse.json({ error: 'Kampaniya topilmadi yoki allaqachon yuborish jarayonida.' }, { status: 409 })
    return NextResponse.json({ message: 'Rejalashtirilgan kampaniya bekor qilindi.' })
  }
  const destination = String(body.destination || 'bot') as Destination
  if (!['bot', 'channel'].includes(destination)) return NextResponse.json({ error: 'Noto‘g‘ri yuborish manzili.' }, { status: 400 })
  const channelChatId = MARKETING_CHANNEL_CHAT_ID
  const title = String(body.title || '').trim()
  const message = String(body.message || '').trim()
  const buttonText = String(body.buttonText || '').trim()
  const buttonUrl = String(body.buttonUrl || '').trim()
  const audience = String(body.audience || 'all') as Audience
  const mediaUrl = String(body.mediaUrl || '').trim()
  const mediaName = String(body.mediaName || '').trim()
  let mediaType: MediaType | null = null
  if (!title || !message) return NextResponse.json({ error: 'Sarlavha va xabar matni majburiy.' }, { status: 400 })
  if (buttonUrl && !/^https?:\/\//i.test(buttonUrl)) return NextResponse.json({ error: 'Noto‘g‘ri tugma URL manzili.' }, { status: 400 })
  try { mediaType = validateMedia(mediaUrl, String(body.mediaType || '')) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Media xatosi.' }, { status: 400 }) }

  if (action === 'test_client') {
    const recipientTelegramId = String(body.recipientTelegramId || '').trim()
    if (!recipientTelegramId || !/^\d{5,20}$/.test(recipientTelegramId)) {
      return NextResponse.json({ error: 'Test uchun mijozni tanlang.' }, { status: 400 })
    }

    // Re-check consent server-side; never trust a recipient ID supplied by the browser.
    const { data: eligible, error: eligibilityError } = await supabase.rpc('get_telegram_broadcast_recipients', { p_audience: 'all' })
    if (eligibilityError) return NextResponse.json({ error: 'Marketing roziligi tekshiruvini bajarib bo‘lmadi. Migratsiya qo‘llanganini tekshiring.' }, { status: 503 })
    const isEligible = (eligible || []).some((row: { telegram_id: string }) => String(row.telegram_id) === recipientTelegramId)
    if (!isEligible) return NextResponse.json({ error: 'Tanlangan mijoz faol emas yoki marketing xabarlariga rozilik bermagan.' }, { status: 403 })

    const { data: recipient, error: recipientError } = await supabase.from('telegram_bot_users')
      .select('telegram_user_id,chat_id')
      .eq('telegram_user_id', recipientTelegramId)
      .eq('is_active', true)
      .not('profile_id', 'is', null)
      .maybeSingle()
    if (recipientError) return NextResponse.json({ error: recipientError.message }, { status: 500 })
    if (!recipient?.chat_id) return NextResponse.json({ error: 'Tanlangan mijozning faol Telegram chat ID topilmadi.' }, { status: 404 })

    try {
      await sendCampaignMessage(recipient.chat_id, title, message, buttonText, buttonUrl, mediaUrl, mediaType)
      return NextResponse.json({ message: 'Test xabari tanlangan mijozga yuborildi.', recipientTelegramId })
    } catch (error) {
      const errorText = error instanceof Error ? error.message : 'Telegram API xatosi'
      if (/blocked|chat not found|user is deactivated/i.test(errorText)) {
        await supabase.from('telegram_bot_users').update({ is_active: false, blocked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('telegram_user_id', recipientTelegramId)
      }
      return NextResponse.json({ error: errorText }, { status: 502 })
    }
  }

  if (destination === 'channel' && !channelChatId) return NextResponse.json({ error: 'TELEGRAM_MARKETING_CHANNEL_ID server sozlamasida mavjud emas.' }, { status: 503 })
  if (destination === 'bot' && !['all', 'buyers', 'listings', 'realtors', 'trusted'].includes(audience)) return NextResponse.json({ error: 'Noto‘g‘ri auditoriya.' }, { status: 400 })
  const scheduledAt = action === 'schedule' ? parseTashkentDateTime(body.scheduledAt) : null
  if (action === 'schedule') {
    if (!scheduledAt) return NextResponse.json({ error: 'Yuborish sanasi va vaqtini to‘g‘ri kiriting.' }, { status: 400 })
    const delay = scheduledAt.getTime() - Date.now()
    if (delay < 2 * 60 * 1000) return NextResponse.json({ error: 'Yuborish vaqti hozirdan kamida 2 daqiqa keyin bo‘lishi kerak.' }, { status: 400 })
    if (delay > 365 * 24 * 60 * 60 * 1000) return NextResponse.json({ error: 'Kampaniyani 1 yildan uzoq muddatga rejalashtirib bo‘lmaydi.' }, { status: 400 })
  }
  const { data: marketingReady, error: marketingReadyError } = await supabase.rpc('get_telegram_marketing_eligible_count')
  if (marketingReadyError) return NextResponse.json({ error: 'Marketing roziligi sxemasi hali bazaga qo‘llanmagan. Ommaviy yuborish bloklandi; test xabari ishlashi mumkin.' }, { status: 503 })
  if (destination === 'channel') {
    const { error: destinationSchemaError } = await supabase.from('telegram_broadcast_campaigns').select('destination').limit(1)
    if (destinationSchemaError) return NextResponse.json({ error: 'Kanal kampaniyalari uchun database migratsiyasi hali qo‘llanmagan.' }, { status: 503 })
  }
  const { data: campaign, error: campaignError } = await supabase.from('telegram_broadcast_campaigns').insert({ title, message, button_text: buttonText || null, button_url: buttonUrl || null, audience, destination, channel_chat_id: destination === 'channel' ? channelChatId : null, media_url: mediaUrl || null, media_type: mediaType, media_name: mediaName || null, status: action === 'schedule' ? 'queued' : 'sending', scheduled_at: scheduledAt?.toISOString() || null, scheduled_timezone: 'Asia/Tashkent' }).select('id').single()
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 })
  if (action === 'schedule') return NextResponse.json({ message: 'Kampaniya belgilangan vaqtga rejalashtirildi.', campaignId: campaign.id, scheduledAt: scheduledAt?.toISOString() })

  if (destination === 'channel') {
    try {
      const result = await sendCampaignMessage(channelChatId, title, message, buttonText, buttonUrl, mediaUrl, mediaType)
      await supabase.from('telegram_broadcast_deliveries').insert({ campaign_id: campaign.id, telegram_id: channelChatId, status: 'sent', telegram_message_id: Number(result?.message_id || 0) || null })
      await supabase.from('telegram_broadcast_campaigns').update({ status: 'sent', sent_count: 1, delivered_count: 1, recipient_count: 1, failed_count: 0, finished_at: new Date().toISOString() }).eq('id', campaign.id)
      return NextResponse.json({ message: 'Kampaniya kanalga joylandi.', sent: 1, failed: 0 })
    } catch (error) {
      const errorText = error instanceof Error ? error.message : 'Telegram API xatosi'
      await supabase.from('telegram_broadcast_deliveries').insert({ campaign_id: campaign.id, telegram_id: channelChatId, status: 'failed', error: errorText })
      await supabase.from('telegram_broadcast_campaigns').update({ status: 'failed', sent_count: 0, failed_count: 1, recipient_count: 1, finished_at: new Date().toISOString() }).eq('id', campaign.id)
      return NextResponse.json({ error: errorText }, { status: 502 })
    }
  }

  const { data: users, error: usersError } = await supabase.rpc('get_telegram_broadcast_recipients', { p_audience: audience })
  if (usersError) {
    await supabase.from('telegram_broadcast_campaigns').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', campaign.id)
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  let sent = 0; let failed = 0
  for (const user of users || []) {
    try {
      const result = await sendCampaignMessage(String(user.telegram_id), title, message, buttonText, buttonUrl, mediaUrl, mediaType)
      sent += 1
      await supabase.from('telegram_broadcast_deliveries').insert({ campaign_id: campaign.id, telegram_id: String(user.telegram_id), status: 'sent', telegram_message_id: Number(result?.message_id || 0) || null })
    } catch (error) {
      failed += 1
      const errorText = error instanceof Error ? error.message : 'Telegram API xatosi'
      await supabase.from('telegram_broadcast_deliveries').insert({ campaign_id: campaign.id, telegram_id: String(user.telegram_id), status: 'failed', telegram_message_id: null, error: errorText })
      if (/blocked|chat not found|user is deactivated/i.test(errorText)) await supabase.from('telegram_bot_users').update({ is_active: false, blocked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('telegram_user_id', String(user.telegram_id))
    }
  }

  await supabase.from('telegram_broadcast_campaigns').update({ status: failed && !sent ? 'failed' : 'sent', sent_count: sent, delivered_count: sent, recipient_count: (users || []).length, failed_count: failed, finished_at: new Date().toISOString() }).eq('id', campaign.id)
  return NextResponse.json({ message: `Kampaniya yuborildi: ${sent} ta muvaffaqiyatli, ${failed} ta xato.`, sent, failed })
}

function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;') }
