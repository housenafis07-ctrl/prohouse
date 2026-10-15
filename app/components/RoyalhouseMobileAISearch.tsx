'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'

type Tab = 'sale' | 'rent' | 'daily'

type Listing = {
  id: string
  title: string
  title_ru?: string | null
  price?: number | null
  currency?: string | null
  area_m2?: number | null
  rooms?: number | null
  district?: string | null
  city?: string | null
  primary_image?: { image_url?: string | null } | null
}

const complexHints = [
  ' xon', ' xona', ' kvartira', ' uy ', ' hovli', ' yer ', ' uchast', ' tijorat',
  ' ijara', ' ijaraga', ' kunlik', ' sutkalik', ' dacha', ' daча', ' дача', ' yangi uy', ' novost',
  ' mlrd', ' milliard', ' mln', ' million', ' ming $', ' ming y', ' doll', '$',
  ' gacha', ' dan ', ' metro', ' yaqin', ' oil', ' arzon', ' qimmat', ' maydon',
  ' m2', ' m²', 'комнат', 'квартир', 'аренд', 'сутк', 'новост', 'до ', 'млрд', 'млн',
]

function normalize(value: string) {
  return value.toLocaleLowerCase('uz-UZ').replace(/[’‘`ʻʼ]/g, "'").replace(/\s+/g, ' ').trim()
}

function transliterateCyrillic(value: string) {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ғ': "g'", 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'қ': 'q', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ў': "o'",
    'ф': 'f', 'х': 'x', 'ҳ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  }
  return value.toLocaleLowerCase('uz-UZ').split('').map((char) => map[char] ?? char).join('')
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j]
  }
  return previous[b.length]
}

function locationKey(value: string) {
  return transliterateCyrillic(value)
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const searchableLocations = [
  'Toshkent',
  ...UZBEKISTAN_LOCATIONS.flatMap((item) => item.districts),
]

function correctLocationWord(word: string) {
  const normalized = locationKey(word)
  if (normalized.length < 4) return word

  const stripped = normalized.replace(/(da|dan|ga|ni|ning|lik)$/i, '').trim()
  let best: { value: string; distance: number } | null = null

  for (const location of searchableLocations) {
    const key = locationKey(location)
    const base = key.replace(/\s+(tumani|shahri)$/i, '')
    const maxDistance = base.length >= 7 ? 2 : 1
    const candidates = [key, base]
    const distance = Math.min(
      levenshtein(normalized, key),
      levenshtein(normalized, base),
      levenshtein(stripped, base),
    )

    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { value: location, distance }
    }

    if (candidates.includes(normalized) || candidates.includes(stripped)) return location.replace(/\s+(tumani|shahri)$/i, '')
  }

  return best ? best.value.replace(/\s+(tumani|shahri)$/i, '') : word
}

function correctSearchQuery(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map(correctLocationWord)
    .join(' ')
}

function needsAi(query: string) {
  const q = ` ${normalize(query)} `
  const words = q.trim().split(/\s+/).filter(Boolean)
  return words.length >= 3 || complexHints.some((hint) => q.includes(hint))
}

function detectTab(root: HTMLElement | null): Tab {
  if (!root) return 'sale'
  const active = Array.from(root.querySelectorAll('button')).find((button) => button.className.includes('bg-emerald-600'))
  const label = normalize(active?.textContent || '')
  if (label.includes('ijara') || label.includes('аренд')) return 'rent'
  if (label.includes('kunlik') || label.includes('сут')) return 'daily'
  return 'sale'
}

function formatPrice(price: number | null | undefined, currency: string | null | undefined) {
  if (price === null || price === undefined) return ''
  const value = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(price)
  return `${value} ${currency === 'UZS' ? 'so‘m' : currency || ''}`.trim()
}

export default function RoyalhouseMobileAISearch() {
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const [input, setInput] = useState<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    const findInput = () => {
      if (cancelled) return
      const direct = document.querySelector('input[aria-label="Aqlli qidiruv"], input[aria-label="Умный поиск"]') as HTMLInputElement | null
      const fallback = direct || Array.from(document.querySelectorAll('input')).find((node) => /Toshkentda 3 xonali|3-комнатная квартира|Aqlli qidiruv|Умный поиск/i.test(node.getAttribute('placeholder') || '')) as HTMLInputElement | undefined
      if (!fallback) {
        timer = window.setTimeout(findInput, 300)
        return
      }

      const row = fallback.parentElement?.parentElement as HTMLElement | null
      const box = row?.parentElement as HTMLElement | null
      if (!box) {
        timer = window.setTimeout(findInput, 300)
        return
      }

      const resultNode = document.createElement('div')
      resultNode.setAttribute('data-royalhouse-ai-results', 'true')
      box.appendChild(resultNode)
      setInput(fallback)
      setMount(resultNode)
      setQuery(fallback.value || '')

      const onInput = () => setQuery(fallback.value || '')
      const onFocus = () => setQuery(fallback.value || '')
      fallback.addEventListener('input', onInput)
      fallback.addEventListener('focus', onFocus)

      return () => {
        fallback.removeEventListener('input', onInput)
        fallback.removeEventListener('focus', onFocus)
        resultNode.remove()
      }
    }

    const cleanup = findInput()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      if (typeof cleanup === 'function') cleanup()
    }
  }, [])

  useEffect(() => {
    if (!input || !mount) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setItems([])
      setError('')
      setLoading(false)
      setAiMode(false)
      return
    }

    const correctedQuery = correctSearchQuery(trimmed)
    const ai = needsAi(correctedQuery)
    const tab = detectTab(mount.closest('[data-royalhouse-mobile-search]') as HTMLElement | null)
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      setAiMode(ai)

      try {
        const params = new URLSearchParams({ q: correctedQuery, limit: '8', sort: 'newest', tab, all: 'true' })
        const response = await fetch(ai ? '/api/ai/property-search' : `/api/listings/search?${params.toString()}`, {
          method: ai ? 'POST' : 'GET',
          headers: ai ? { 'Content-Type': 'application/json' } : undefined,
          body: ai ? JSON.stringify({ query: correctedQuery, tab, all: true }) : undefined,
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error || 'Qidiruvda xatolik.')
        setItems(Array.isArray(payload?.data) ? payload.data.slice(0, 6) : [])
      } catch (searchError) {
        if (controller.signal.aborted) return
        setItems([])
        setError(searchError instanceof Error ? searchError.message : 'Qidiruvda xatolik.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, ai ? 500 : 280)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [input, mount, query])

  if (!mount) return null

  const locale = typeof document !== 'undefined' && document.documentElement.lang === 'ru' ? 'ru' : 'uz'

  return createPortal(
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm" data-royalhouse-ai-inline-results>
      {loading && <div className="px-3 py-2 text-[11px] font-semibold text-slate-400">{aiMode ? '✦ AI e’lonlarni izlamoqda…' : 'E’lonlar qidirilmoqda…'}</div>}
      {!loading && error && <div className="px-3 py-2 text-[11px] font-semibold text-rose-500">{error}</div>}
      {!loading && !error && items.length > 0 && (
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{aiMode ? '✦ AI qidiruv natijalari' : 'Mos e’lonlar'}</span>
            <span className="text-[9px] font-semibold text-slate-400">{items.length} ta</span>
          </div>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { window.location.assign(`/listings/${encodeURIComponent(item.id)}`) }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50"
            >
              <div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {item.primary_image?.image_url ? <img src={item.primary_image.image_url} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-black text-slate-800">{locale === 'ru' ? item.title_ru || item.title : item.title}</div>
                <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{[item.city, item.district, item.rooms ? `${item.rooms} xona` : '', item.area_m2 ? `${item.area_m2} m²` : ''].filter(Boolean).join(' · ')}</div>
                <div className="mt-1 text-[11px] font-black text-emerald-700">{formatPrice(item.price, item.currency)}</div>
              </div>
              <span className="text-slate-300">›</span>
            </button>
          ))}
        </div>
      )}
      {!loading && !error && trimmedQuery(query).length >= 2 && items.length === 0 && (
        <div className="px-3 py-3 text-[11px] font-semibold text-slate-400">Mos e’lon topilmadi. Boshqa so‘zlar bilan urinib ko‘ring.</div>
      )}
    </div>,
    mount,
  )
}

function trimmedQuery(value: string) {
  return value.trim()
}
