import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const TELEGRAM_API = 'https://api.telegram.org'
const TELEGRAM_MEDIA_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/telegram-media/`

type Audience = 'all' | 'buyers' | 'listings' | 'realtors' | 'trusted'
type MediaType = 'image' | 'video'

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

function caption(title: string, message: string) { return `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}` }

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
  const [{ data: campaigns, error: campaignsError }, { data: counts, error: countsError }] = await Promise.all([
    supabase.from('telegram_broadcast_campaigns').select('id,title,audience,status,sent_count,failed_count,media_url,media_type,media_name,created_at').order('created_at', { ascending: false }).limit(50),
    supabase.rpc('get_telegram_broadcast_audience_counts'),
  ])
  if (campaignsError) return NextResponse.json({ error: campaignsError.message }, { status: 500 })
  if (countsError) return NextResponse.json({ error: countsError.message }, { status: 500 })
  const audienceCounts = Object.fromEntries((counts || []).map((row: { audience: string; count: number | string }) => [row.audience, Number(row.count)]))
  return NextResponse.json({ campaigns: campaigns || [], audienceCounts })
}

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin('listings.moderate')
  if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })
  const supabase = serviceClient()
  const body = await req.json()
  const action = body.action === 'test' ? 'test' : 'broadcast'
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

  if (action === 'test') {
    const { data: botUser, error: botUserError } = await supabase.from('telegram_bot_users').select('chat_id,telegram_user_id').eq('auth_user_id', admin!.user.id).eq('is_active', true).maybeSingle()
    if (botUserError) return NextResponse.json({ error: botUserError.message }, { status: 500 })
    let chatId = botUser?.chat_id || null
    if (!chatId) {
      const { data: linkedTelegram, error: linkedTelegramError } = await supabase.from('telegram_user_links').select('chat_id').eq('profile_id', admin!.user.id).maybeSingle()
      if (linkedTelegramError) return NextResponse.json({ error: linkedTelegramError.message }, { status: 500 })
      chatId = linkedTelegram?.chat_id || null
    }
    if (!chatId) return NextResponse.json({ error: 'Admin Telegram akkaunti hali ulanmagan. Avval “Telegramni ulash” tugmasini bosing, keyin @RoyalHouseUz_bot ichida Start bosing.' }, { status: 400 })
    await sendCampaignMessage(chatId, title, message, buttonText, buttonUrl, mediaUrl, mediaType)
    return NextResponse.json({ message: 'Test xabari yuborildi.' })
  }

  if (!['all', 'buyers', 'listings', 'realtors', 'trusted'].includes(audience)) return NextResponse.json({ error: 'Noto‘g‘ri auditoriya.' }, { status: 400 })
  const { data: campaign, error: campaignError } = await supabase.from('telegram_broadcast_campaigns').insert({ title, message, button_text: buttonText || null, button_url: buttonUrl || null, audience, media_url: mediaUrl || null, media_type: mediaType, media_name: mediaName || null, status: 'sending' }).select('id').single()
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 })

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

  await supabase.from('telegram_broadcast_campaigns').update({ status: failed && !sent ? 'failed' : 'sent', sent_count: sent, failed_count: failed, finished_at: new Date().toISOString() }).eq('id', campaign.id)
  return NextResponse.json({ message: `Kampaniya yuborildi: ${sent} ta muvaffaqiyatli, ${failed} ta xato.`, sent, failed })
}

function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;') }
