import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const TELEGRAM_API = 'https://api.telegram.org'

type Audience = 'all' | 'buyers' | 'listings' | 'realtors' | 'trusted'

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.ROYALHOUSE_TELEGRAM_BOT_TOKEN || ''
}

async function telegram(method: string, body: Record<string, unknown>) {
  const token = botToken()
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN sozlanmagan')
  const r = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await r.json()
  if (!r.ok || !data.ok) throw new Error(data.description || 'Telegram API xatosi')
  return data.result
}

export async function GET() {
  const { error: authError } = await requireAdmin('listings.moderate')
  if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })

  const supabase = serviceClient()
  const [{ data: campaigns, error: campaignsError }, { data: counts, error: countsError }] = await Promise.all([
    supabase.from('telegram_broadcast_campaigns').select('id,title,audience,status,sent_count,failed_count,created_at').order('created_at', { ascending: false }).limit(50),
    supabase.rpc('get_telegram_broadcast_audience_counts'),
  ])
  if (campaignsError) return NextResponse.json({ error: campaignsError.message }, { status: 500 })
  if (countsError) return NextResponse.json({ error: countsError.message }, { status: 500 })

  const audienceCounts = Object.fromEntries((counts || []).map((row: { audience: string; count: number | string }) => [row.audience, Number(row.count)]))
  return NextResponse.json({ campaigns: campaigns || [], audienceCounts })
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin('listings.moderate')
  if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })

  const supabase = serviceClient()
  const body = await req.json()
  const action = body.action === 'test' ? 'test' : 'broadcast'
  const title = String(body.title || '').trim()
  const message = String(body.message || '').trim()
  const buttonText = String(body.buttonText || '').trim()
  const buttonUrl = String(body.buttonUrl || '').trim()
  const audience = String(body.audience || 'all') as Audience

  if (!title || !message) return NextResponse.json({ error: 'Sarlavha va xabar matni majburiy.' }, { status: 400 })
  if (buttonUrl && !/^https?:\/\//i.test(buttonUrl)) return NextResponse.json({ error: 'Noto‘g‘ri tugma URL manzili.' }, { status: 400 })

  if (action === 'test') {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (!adminChatId) return NextResponse.json({ error: 'TELEGRAM_ADMIN_CHAT_ID sozlanmagan.' }, { status: 500 })
    await telegram('sendMessage', {
      chat_id: adminChatId,
      text: `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}`,
      parse_mode: 'HTML',
      ...(buttonText && buttonUrl ? { reply_markup: { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] } } : {}),
    })
    return NextResponse.json({ message: 'Test xabari yuborildi.' })
  }

  if (!['all', 'buyers', 'listings', 'realtors', 'trusted'].includes(audience)) return NextResponse.json({ error: 'Noto‘g‘ri auditoriya.' }, { status: 400 })

  const { data: campaign, error: campaignError } = await supabase.from('telegram_broadcast_campaigns').insert({
    title,
    message,
    button_text: buttonText || null,
    button_url: buttonUrl || null,
    audience,
    status: 'sending',
  }).select('id').single()
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 })

  const { data: users, error: usersError } = await supabase.rpc('get_telegram_broadcast_recipients', { p_audience: audience })
  if (usersError) {
    await supabase.from('telegram_broadcast_campaigns').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', campaign.id)
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  let sent = 0
  let failed = 0
  for (const user of users || []) {
    try {
      const result = await telegram('sendMessage', {
        chat_id: user.telegram_id,
        text: `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}`,
        parse_mode: 'HTML',
        ...(buttonText && buttonUrl ? { reply_markup: { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] } } : {}),
      })
      sent += 1
      await supabase.from('telegram_broadcast_deliveries').insert({
        campaign_id: campaign.id,
        telegram_id: String(user.telegram_id),
        status: 'sent',
        telegram_message_id: Number(result?.message_id || 0) || null,
      })
    } catch (error) {
      failed += 1
      const errorText = error instanceof Error ? error.message : 'Telegram API xatosi'
      await supabase.from('telegram_broadcast_deliveries').insert({
        campaign_id: campaign.id,
        telegram_id: String(user.telegram_id),
        status: 'failed',
        error: errorText,
      })
      if (/blocked|chat not found|user is deactivated/i.test(errorText)) {
        await supabase.from('telegram_bot_users').update({ is_active: false, blocked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('telegram_user_id', String(user.telegram_id))
      }
    }
  }

  await supabase.from('telegram_broadcast_campaigns').update({
    status: failed && !sent ? 'failed' : 'sent',
    sent_count: sent,
    failed_count: failed,
    finished_at: new Date().toISOString(),
  }).eq('id', campaign.id)

  return NextResponse.json({ message: `Kampaniya yuborildi: ${sent} ta muvaffaqiyatli, ${failed} ta xato.`, sent, failed })
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
