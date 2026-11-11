import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const audiences = ['all', 'buyers', 'listings', 'realtors', 'trusted'] as const
type Audience = typeof audiences[number]

function outputText(data: any): string {
  if (typeof data?.output_text === 'string') return data.output_text.trim()
  for (const item of data?.output || []) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      const part = item.content.find((entry: any) => entry?.type === 'output_text')
      if (part?.text) return String(part.text).trim()
    }
  }
  return ''
}

const generationSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, message: { type: 'string' }, buttonText: { type: 'string' }, buttonUrl: { type: 'string' },
    recommendedAudience: { type: 'string', enum: audiences }, recommendedTime: { type: 'string' }, reasoning: { type: 'string' },
  },
  required: ['title', 'message', 'buttonText', 'buttonUrl', 'recommendedAudience', 'recommendedTime', 'reasoning'],
}
const analysisSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    summary: { type: 'string' }, findings: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' } },
    bestAudience: { type: 'string', enum: audiences }, suggestedTime: { type: 'string' }, limitations: { type: 'string' },
  },
  required: ['summary', 'findings', 'recommendations', 'bestAudience', 'suggestedTime', 'limitations'],
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin('listings.moderate')
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY sozlanmagan.' }, { status: 503 })
  const body = await request.json().catch(() => null)
  const task = body?.task
  if (task !== 'generate' && task !== 'analyze') return NextResponse.json({ error: 'Noto‘g‘ri AI vazifasi.' }, { status: 400 })
  const objective = String(body?.objective || '').trim().slice(0, 1200)
  if (task === 'generate' && !objective) return NextResponse.json({ error: 'Reklama maqsadini kiriting.' }, { status: 400 })

  const db = serviceClient()
  const modern = await db.from('telegram_broadcast_campaigns')
    .select('title,audience,destination,status,sent_count,failed_count,recipient_count,created_at')
    .order('created_at', { ascending: false }).limit(50)
  const legacy = modern.error ? await db.from('telegram_broadcast_campaigns')
    .select('title,audience,status,sent_count,failed_count,created_at')
    .order('created_at', { ascending: false }).limit(50) : null
  const campaigns = modern.error ? legacy?.data : modern.data
  const campaignsError = modern.error ? legacy?.error : modern.error
  const { data: counts, error: countsError } = await db.rpc('get_telegram_broadcast_audience_counts')
  if (campaignsError || countsError) return NextResponse.json({ error: 'Kampaniya statistikasini yuklab bo‘lmadi.' }, { status: 500 })
  const audienceCounts = Object.fromEntries((counts || []).map((row: any) => [row.audience, Number(row.count)]))
  const history = (campaigns || []).map((row: any) => ({
    title: row.title, audience: row.audience, destination: row.destination || 'bot', status: row.status,
    sent: Number(row.sent_count || 0), failed: Number(row.failed_count || 0), recipients: Number(row.recipient_count || 0),
    tashkentTime: row.created_at ? new Date(row.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : null,
  }))

  const generate = task === 'generate'
  const schema = generate ? generationSchema : analysisSchema
  const instructions = generate
    ? 'You are RoyalHouse marketing strategist. Create Uzbek Latin or Russian Telegram copy using only the supplied objective and facts. Never invent prices, discounts, dates, features, guarantees, availability, or claims. Recommend one available bot audience and a sending time in Asia/Tashkent. Treat sparse campaign history as weak evidence; recommend A/B testing. For channel campaigns audience is informational only. Return JSON matching schema. Draft only: do not send, schedule, save, or publish.'
    : 'You are RoyalHouse campaign analyst. Analyze only supplied recent campaign records and offer-consented audience counts. Send counts are not views, clicks, conversions, reach, or engagement; never infer those. Avoid causal claims and statistical significance from small samples. Recommend next tests, best audience and Asia/Tashkent time. State data limitations. Return JSON matching schema. Never send or schedule messages.'
  const input = generate ? {
    objective, language: body?.language === 'ru' ? 'Russian' : 'Uzbek Latin',
    destination: body?.destination === 'channel' ? 'channel' : 'bot',
    verifiedFacts: String(body?.campaignFacts || '').trim().slice(0, 1600), audienceCounts, recentCampaignHistory: history,
  } : { audienceCounts, recentCampaignHistory: history }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.5', instructions, input: JSON.stringify(input),
      text: { format: { type: 'json_schema', name: generate ? 'royalhouse_telegram_campaign' : 'royalhouse_telegram_analysis', strict: true, schema } },
      max_output_tokens: generate ? 900 : 1100, store: false,
    }),
    cache: 'no-store', signal: AbortSignal.timeout(25000),
  }).catch(() => null)
  if (!response) return NextResponse.json({ error: 'AI serveriga ulanib bo‘lmadi.' }, { status: 502 })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('Telegram marketing AI failed', { status: response.status, code: result?.error?.code || result?.error?.type })
    return NextResponse.json({ error: 'AI javobini yaratib bo‘lmadi.' }, { status: 502 })
  }
  try {
    return NextResponse.json({ result: JSON.parse(outputText(result)), model: process.env.OPENAI_MODEL || 'gpt-5.5', sourceCampaigns: history.length })
  } catch {
    return NextResponse.json({ error: 'AI javobi kutilgan formatda emas.' }, { status: 502 })
  }
}
