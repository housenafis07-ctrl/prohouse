import { NextRequest, NextResponse } from 'next/server'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

type SearchFilters = {
  tab: 'sale' | 'rent' | 'daily'
  q: string
  city: string
  district: string
  property_type: string
  rooms: number | null
  min: number | null
  max: number | null
  currency: string
  min_area: number | null
  sort: 'newest' | 'priceLow' | 'priceHigh'
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tab: { type: 'string', enum: ['sale', 'rent', 'daily'] },
    q: { type: 'string' },
    city: { type: 'string' },
    district: { type: 'string' },
    property_type: { type: 'string' },
    rooms: { type: ['number', 'null'] },
    min: { type: ['number', 'null'] },
    max: { type: ['number', 'null'] },
    currency: { type: 'string' },
    min_area: { type: ['number', 'null'] },
    sort: { type: 'string', enum: ['newest', 'priceLow', 'priceHigh'] },
  },
  required: ['tab', 'q', 'city', 'district', 'property_type', 'rooms', 'min', 'max', 'currency', 'min_area', 'sort'],
} as const

function clean(value: unknown, max = 120) {
  return String(value ?? '').trim().slice(0, max)
}

function transliterateCyrillic(value: string) {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ғ': "g'", 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'қ': 'q', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ў': "o'",
    'ф': 'f', 'х': 'x', 'ҳ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  }
  return value
    .toLocaleLowerCase('uz-UZ')
    .split('')
    .map((char) => map[char] ?? char)
    .join('')
}

function locationKey(value: string) {
  return transliterateCyrillic(value)
    .toLocaleLowerCase('uz-UZ')
    .replace(/[’‘`ʻʼ]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function locationBase(value: string) {
  return locationKey(value).replace(/\s+(tumani|shahri|viloyati|respublikasi)$/i, '').trim()
}

const districtNames = UZBEKISTAN_LOCATIONS.flatMap((item) => item.districts)
const cityNames = Array.from(new Set([
  'Toshkent',
  ...districtNames.filter((name) => /\s+shahri$/i.test(name)).map((name) => name.replace(/\s+shahri$/i, '')),
]))

function canonicalLocation(value: string, kind: 'city' | 'district') {
  const input = clean(value, 100)
  if (!input) return ''

  const candidates = kind === 'city' ? cityNames : districtNames
  const exact = candidates.find((candidate) => locationKey(candidate) === locationKey(input))
  if (exact) return kind === 'city' && exact === 'Toshkent shahri' ? 'Toshkent' : exact

  const base = locationBase(input)
  const baseMatch = candidates.find((candidate) => locationBase(candidate) === base)
  if (baseMatch) return kind === 'city' && baseMatch === 'Toshkent shahri' ? 'Toshkent' : baseMatch

  return input
}

function normalizeFilters(raw: Partial<SearchFilters>, fallbackTab: SearchFilters['tab']): SearchFilters {
  const tab = raw.tab === 'rent' || raw.tab === 'daily' ? raw.tab : fallbackTab
  const finite = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }

  return {
    tab,
    q: clean(raw.q, 100),
    city: canonicalLocation(clean(raw.city, 100), 'city'),
    district: canonicalLocation(clean(raw.district, 100), 'district'),
    property_type: clean(raw.property_type, 60),
    rooms: finite(raw.rooms),
    min: finite(raw.min),
    max: finite(raw.max),
    currency: clean(raw.currency, 12),
    min_area: finite(raw.min_area),
    sort: raw.sort === 'priceLow' || raw.sort === 'priceHigh' ? raw.sort : 'newest',
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { query?: unknown; tab?: unknown } | null
  const query = clean(body?.query, 500)
  const fallbackTab = body?.tab === 'rent' || body?.tab === 'daily' ? body.tab : 'sale'

  if (!query) return NextResponse.json({ error: 'Qidiruv so‘rovi bo‘sh.' }, { status: 400 })
  if (query.length > 500) return NextResponse.json({ error: 'Qidiruv so‘rovi juda uzun.' }, { status: 400 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI qidiruv hozircha sozlanmagan.' }, { status: 503 })

  const model = process.env.OPENAI_MODEL || 'gpt-6-luna'
  const instructions = [
    'You are the RoyalHouse real-estate search parser.',
    'Convert the user request into search filters for the existing RoyalHouse public listing search.',
    'Never invent a city, district, price, room count, or property type that is not supported by the request.',
    'Uzbek and Russian language input must both be understood.',
    'Preserve the user\'s location intent even when it is written in Cyrillic. For example, Тошкент means Toshkent and Сергели means Sergeli.',
    'For sale, use tab=sale. For monthly rent, use tab=rent. For daily/dacha rent, use tab=daily.',
    'Use property_type only for clear categories: apartment, house, land, commercial. Otherwise use an empty string.',
    'Normalize money into the numeric amount in the requested currency. Examples: 1 mlrd -> 1000000000 UZS, 800 mln -> 800000000 UZS, 50 ming $ -> 50000 USD.',
    'If the user asks for the cheapest/lowest-priced options, use sort=priceLow. Otherwise use newest.',
    'Keep q short: only the useful free-text search terms that should remain for the existing catalogue search.',
    'Return JSON only according to the supplied schema.',
  ].join(' ')

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions,
      input: query,
      text: {
        format: {
          type: 'json_schema',
          name: 'royalhouse_property_search',
          strict: true,
          schema,
        },
      },
      max_output_tokens: 400,
    }),
    signal: AbortSignal.timeout(15000),
  }).catch((error) => {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'AI request failed' }), { status: 502 })
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    return NextResponse.json({ error: errorBody?.error?.message || 'AI qidiruv xatosi.' }, { status: 502 })
  }

  const payload = await response.json() as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }
  const outputText = typeof payload.output_text === 'string'
    ? payload.output_text
    : payload.output?.flatMap((item) => item.content || []).find((content) => content.type === 'output_text')?.text || ''

  let rawFilters: Partial<SearchFilters>
  try {
    rawFilters = JSON.parse(outputText) as Partial<SearchFilters>
  } catch {
    return NextResponse.json({ error: 'AI qidiruv javobi o‘qilmadi.' }, { status: 502 })
  }

  const filters = normalizeFilters(rawFilters, fallbackTab)
  const params = new URLSearchParams({
    limit: '8',
    sort: filters.sort,
    tab: filters.tab,
  })

  if (filters.q) params.set('q', filters.q)
  if (filters.city) params.set('city', filters.city)
  if (filters.district) params.set('district', filters.district)
  if (filters.property_type) params.set('property_type', filters.property_type)
  if (filters.rooms !== null) params.set('rooms', String(filters.rooms))
  if (filters.min !== null) params.set('min', String(filters.min))
  if (filters.max !== null) params.set('max', String(filters.max))
  if (filters.currency) params.set('currency', filters.currency)
  if (filters.min_area !== null) params.set('min_area', String(filters.min_area))

  const searchUrl = new URL('/api/listings/search', request.url)
  searchUrl.search = params.toString()
  const listingsResponse = await fetch(searchUrl, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
  const listingsPayload = await listingsResponse.json().catch(() => ({}))

  if (!listingsResponse.ok) {
    return NextResponse.json({ error: listingsPayload?.error || 'E‘lonlarni qidirishda xatolik.' }, { status: 502 })
  }

  return NextResponse.json({
    mode: 'ai',
    filters,
    data: Array.isArray(listingsPayload?.data) ? listingsPayload.data : [],
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
