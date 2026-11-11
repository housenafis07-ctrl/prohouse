import { NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TELEGRAM_API = 'https://api.telegram.org'
const MEDIA_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/telegram-media/`

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.ROYALHOUSE_TELEGRAM_BOT_TOKEN || ''
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\"/g, '&quot;')
}

async function telegram(method: string, body: Record<string, unknown>) {
  const token = botToken()
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN sozlanmagan')
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  })
  const data = await response.json()
  if (!response.ok || !data.ok) throw new Error(data.description || 'Telegram API xatosi')
  return data.result
}

async function sendCampaignMessage(chatId: string, campaign: any) {
  const text = `<b>${escapeHtml(String(campaign.title || ''))}</b>\n\n${escapeHtml(String(campaign.message || ''))}`
  const buttonText = String(campaign.button_text || '')
  const buttonUrl = String(campaign.button_url || '')
  const replyMarkup = buttonText && buttonUrl ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] } : undefined
  const mediaUrl = String(campaign.media_url || '')
  const mediaType = campaign.media_type === 'image' || campaign.media_type === 'video' ? campaign.media_type : null

  if (mediaUrl && !mediaUrl.startsWith(MEDIA_PREFIX)) throw new Error('Media manzili RoyalHouse Telegram storage manzilidan emas.')
  if (mediaUrl && mediaType) {
    const result = await telegram(mediaType === 'image' ? 'sendPhoto' : 'sendVideo', {
      chat_id: chatId,
      [mediaType === 'image' ? 'photo' : 'video']: mediaUrl,
      caption: text.slice(0, 1024),
      parse_mode: 'HTML',
      show_caption_above_media: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    })
    if (text.length > 1024) await telegram('sendMessage', { chat_id: chatId, text: text.slice(1024), parse_mode: 'HTML' })
    return result
  }
  return telegram('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...(replyMarkup ? { reply_markup: replyMarkup } : {}) })
}

async function dispatch(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = serviceClient()
  const { data: campaigns, error } = await db.rpc('claim_due_telegram_broadcast_campaigns', { p_limit: 5 })
  if (error) {
    console.error('[telegram campaign cron] claim failed', error)
    return NextResponse.json({ error: 'Scheduled campaign claim failed' }, { status: 500 })
  }

  const results: Array<{ id: string; sent: number; failed: number }> = []
  for (const campaign of campaigns || []) {
    let sent = 0
    let failed = 0
    try {
      if (campaign.destination === 'channel') {
        const chatId = String(campaign.channel_chat_id || process.env.TELEGRAM_MARKETING_CHANNEL_ID || '')
        if (!chatId) throw new Error('TELEGRAM_MARKETING_CHANNEL_ID sozlanmagan')
        const result = await sendCampaignMessage(chatId, campaign)
        const { error: deliveryError } = await db.from('telegram_broadcast_deliveries').insert({
          campaign_id: campaign.id, telegram_id: chatId, status: 'sent',
          telegram_message_id: Number(result?.message_id || 0) || null,
        })
        if (deliveryError) throw deliveryError
        sent = 1
      } else {
        const { data: recipients, error: recipientError } = await db.rpc('get_telegram_broadcast_recipients', { p_audience: campaign.audience })
        if (recipientError) throw recipientError
        for (const recipient of recipients || []) {
          const telegramId = String(recipient.telegram_id || '')
          if (!telegramId) continue
          try {
            const result = await sendCampaignMessage(telegramId, campaign)
            sent++
            const { error: deliveryError } = await db.from('telegram_broadcast_deliveries').insert({
              campaign_id: campaign.id, telegram_id: telegramId, status: 'sent',
              telegram_message_id: Number(result?.message_id || 0) || null,
            })
            if (deliveryError) throw deliveryError
          } catch (deliveryError) {
            failed++
            const errorText = deliveryError instanceof Error ? deliveryError.message : 'Telegram API xatosi'
            await db.from('telegram_broadcast_deliveries').insert({
              campaign_id: campaign.id, telegram_id: telegramId, status: 'failed', error: errorText,
            })
            if (/blocked|chat not found|user is deactivated/i.test(errorText)) {
              await db.from('telegram_bot_users').update({
                is_active: false, blocked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              }).eq('telegram_user_id', telegramId)
            }
          }
        }
      }
      await db.from('telegram_broadcast_campaigns').update({
        status: failed && !sent ? 'failed' : 'sent',
        sent_count: sent, delivered_count: sent,
        recipient_count: campaign.destination === 'channel' ? 1 : sent + failed,
        failed_count: failed, finished_at: new Date().toISOString(),
      }).eq('id', campaign.id)
      results.push({ id: campaign.id, sent, failed })
    } catch (campaignError) {
      const errorText = campaignError instanceof Error ? campaignError.message : 'Kampaniya yuborilmadi'
      console.error('[telegram campaign cron] campaign failed', campaign.id, errorText)
      await db.from('telegram_broadcast_campaigns').update({
        status: 'failed', failed_count: Math.max(1, failed), sent_count: sent,
        finished_at: new Date().toISOString(),
      }).eq('id', campaign.id)
      results.push({ id: campaign.id, sent, failed: Math.max(1, failed) })
    }
  }

  return NextResponse.json({ ok: true, claimed: (campaigns || []).length, results })
}


export async function GET(request: Request) { return dispatch(request) }
export async function POST(request: Request) { return dispatch(request) }
