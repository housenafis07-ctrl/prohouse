import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

type ListingFacts = {
  title?: string
  description?: string
  property_type?: string
  listing_type?: string
  rooms?: string | number | null
  area_m2?: string | number | null
  floor?: string | number | null
  floors_total?: string | number | null
  city?: string
  district?: string
  neighborhood?: string
  price?: string | number | null
  currency?: string
  address?: string
  attributes?: Record<string, string | number | boolean | null>
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function safeFacts(input: unknown): ListingFacts {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const attributes = raw.attributes && typeof raw.attributes === 'object' ? raw.attributes as Record<string, unknown> : {}
  return {
    title: clean(raw.title, 180),
    description: clean(raw.description, 1200),
    property_type: clean(raw.property_type, 80),
    listing_type: clean(raw.listing_type, 40),
    rooms: raw.rooms == null ? null : clean(raw.rooms, 20),
    area_m2: raw.area_m2 == null ? null : clean(raw.area_m2, 20),
    floor: raw.floor == null ? null : clean(raw.floor, 20),
    floors_total: raw.floors_total == null ? null : clean(raw.floors_total, 20),
    city: clean(raw.city, 100),
    district: clean(raw.district, 100),
    neighborhood: clean(raw.neighborhood, 100),
    price: raw.price == null ? null : clean(raw.price, 40),
    currency: clean(raw.currency, 12),
    address: clean(raw.address, 160),
    attributes: Object.fromEntries(Object.entries(attributes).slice(0, 40).map(([key, value]) => [clean(key, 60), typeof value === 'string' ? clean(value, 120) : value])),
  }
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    description: { type: 'string' },
    used_facts: { type: 'array', items: { type: 'string' } },
  },
  required: ['description', 'used_facts'],
} as const

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { facts?: unknown; language?: unknown } | null
  const facts = safeFacts(body?.facts)
  const language = body?.language === 'ru' ? 'ru' : 'uz'
  if (!facts.description && !facts.title && !facts.rooms && !facts.area_m2 && !facts.district) {
    return NextResponse.json({ error: language === 'ru' ? 'Добавьте хотя бы немного информации об объявлении.' : 'E’lon haqida kamida bir nechta ma’lumot kiriting.' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: language === 'ru' ? 'AI сейчас недоступен.' : 'AI hozircha sozlanmagan.' }, { status: 503 })
  const model = process.env.OPENAI_MODEL || 'gpt-6-luna'

  const instructions = [
    'You are the RoyalHouse real-estate listing description editor.',
    'Rewrite the supplied listing description into clear, professional, natural marketplace copy.',
    'Use ONLY facts explicitly present in the supplied facts object. Never infer, estimate, embellish, invent or add amenities, distances, views, renovation details, legal status, documents, payment options, infrastructure or other facts.',
    'If a fact is missing, omit it. Do not fill gaps with typical real-estate language that implies an unverified fact.',
    'Preserve the user’s meaning and keep the description concise: normally 2-5 short sentences or a short paragraph.',
    'Do not add emojis, hashtags, phone numbers, calls to action, guarantees, superlatives or advertising claims.',
    language === 'ru' ? 'Write in Russian.' : 'Write in Uzbek Latin script. Keep proper names such as Chilonzor and Sergeli in their supplied form.',
    'Return JSON only according to the supplied schema.',
  ].join(' ')

  const input = JSON.stringify({ facts, language })
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      instructions,
      input,
      text: { format: { type: 'json_schema', name: 'royalhouse_listing_description', strict: true, schema } },
      max_output_tokens: 500,
    }),
    signal: AbortSignal.timeout(15000),
  }).catch((error) => new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'AI request failed' }), { status: 502 }))

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    return NextResponse.json({ error: errorBody?.error?.message || (language === 'ru' ? 'Ошибка AI.' : 'AI xatosi.') }, { status: 502 })
  }

  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
  const outputText = typeof payload.output_text === 'string'
    ? payload.output_text
    : payload.output?.flatMap((item) => item.content || []).find((content) => content.type === 'output_text')?.text || ''

  try {
    const result = JSON.parse(outputText) as { description?: string; used_facts?: string[] }
    const description = clean(result.description, 1500)
    if (!description) throw new Error('EMPTY_DESCRIPTION')
    return NextResponse.json({ description, used_facts: Array.isArray(result.used_facts) ? result.used_facts.slice(0, 30) : [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: language === 'ru' ? 'Не удалось прочитать ответ AI.' : 'AI javobini o‘qib bo‘lmadi.' }, { status: 502 })
  }
}
