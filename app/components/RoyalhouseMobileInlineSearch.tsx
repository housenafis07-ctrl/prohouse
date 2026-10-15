'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'
import { useI18n } from './I18nProvider'

type Tab = 'sale' | 'rent' | 'daily' | 'new'

type Filters = {
  tab: Tab
  region?: string
  district?: string
  property_type?: string
  rooms?: string
  min?: string
  max?: string
  currency?: string
  q?: string
}

type Listing = {
  id: string
  title: string
  title_ru?: string | null
  price: number
  currency: string
  city: string | null
  district: string | null
  property_type?: string | null
  listing_type?: string | null
  rooms?: number | null
  area_m2?: number | null
  is_mortgage_available?: boolean | null
  is_trusted_seller?: boolean | null
  effective_promotion_badge?: string | null
  primary_image?: { image_url: string } | null
}

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('uz-UZ')
    .replace(/[’‘`ʻ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

function parseQuery(input: string, tab: Tab): Filters {
  const q = normalize(input)
  const result: Filters = { tab }

  if (/\b(ijara|ijaraga|аренда|rent|sotib olmay|снять|сниму)\b/.test(q)) result.tab = 'rent'
  if (/\b(kunlik|sutkalik|dacha|dachalar|дача|посут|сутки)\b/.test(q)) result.tab = 'daily'
  if (/\b(yangi bino|yangi uy|novostroy|новострой|новостройки)\b/.test(q)) result.tab = 'new'

  const room = q.match(/(\d+)\s*(xona|xonali|xonadan|komna|комн|комнат)/i)
  if (room) result.rooms = room[1]

  const billion = q.match(/(\d+(?:[.,]\d+)?)\s*(mlrd|milliard|млрд)/i)
  const million = q.match(/(\d+(?:[.,]\d+)?)\s*(mln|million|млн)/i)
  const thousand = q.match(/(\d+(?:[.,]\d+)?)\s*(ming|тыс)/i)
  const plainMoney = q.match(/\b(\d{7,12})\b/)

  if (billion) {
    result.max = String(Math.round(Number(billion[1].replace(',', '.')) * 1_000_000_000))
    result.currency = 'UZS'
  } else if (million) {
    result.max = String(Math.round(Number(million[1].replace(',', '.')) * 1_000_000))
    result.currency = 'UZS'
  } else if (thousand) {
    result.max = String(Math.round(Number(thousand[1].replace(',', '.')) * 1_000))
    result.currency = 'UZS'
  } else if (plainMoney) {
    result.max = plainMoney[1]
    result.currency = 'UZS'
  }

  const locations = UZBEKISTAN_LOCATIONS.flatMap((location) => [
    { name: location.name, kind: 'region' as const },
    ...location.districts.map((district) => ({ name: district, kind: 'district' as const })),
  ])

  const location = locations
    .sort((a, b) => b.name.length - a.name.length)
    .find((item) => q.includes(normalize(item.name)))

  if (location?.kind === 'region') result.region = location.name
  if (location?.kind === 'district') result.district = location.name

  if (/\b(kvartira|kvartiraga|xonadon|квартира|апартамент|apartment)\b/.test(q)) result.property_type = 'apartment'
  else if (/\b(hovli|xususiy uy|uy-joy|дом|коттедж|house)\b/.test(q)) result.property_type = 'house'
  else if (/\b(yer|uchastka|земля|участок)\b/.test(q)) result.property_type = 'land'
  else if (/\b(tijorat|commercial|коммерц)\b/.test(q)) result.property_type = 'commercial'

  const structured = Boolean(result.region || result.district || result.property_type || result.rooms || result.max || result.tab !== tab)
  if (!structured && input.trim()) result.q = input.trim()

  return result
}

function toParams(filters: Filters) {
  const params = new URLSearchParams()
  params.set('tab', filters.tab === 'new' ? 'sale' : filters.tab)
  params.set('limit', '6')
  params.set('sort', 'newest')
  if (filters.tab === 'new') params.set('property_type', 'new_building')
  if (filters.region) params.set('region', filters.region)
  if (filters.district) params.set('district', filters.district)
  if (filters.property_type) params.set('property_type', filters.property_type)
  if (filters.rooms) params.set('rooms', filters.rooms)
  if (filters.max) params.set('max', filters.max)
  if (filters.min) params.set('min', filters.min)
  if (filters.currency) params.set('currency', filters.currency)
  if (filters.q) params.set('q', filters.q)
  return params
}

function formatPrice(value: number, currency: string, lang: string) {
  const formatted = new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ').format(value)
  return currency === 'USD' ? `$${formatted}` : `${formatted} so‘m`
}

function propertyLabel(value: string | null | undefined, lang: string) {
  const labels: Record<string, [string, string]> = {
    apartment: ['Kvartira', 'Квартира'],
    house: ['Xususiy uy', 'Частный дом'],
    land: ['Yer', 'Земля'],
    commercial: ['Tijorat', 'Коммерция'],
    new_building: ['Yangi bino', 'Новостройка'],
  }
  return labels[value || '']?.[lang === 'ru' ? 1 : 0] || value || ''
}

export default function RoyalhouseMobileInlineSearch() {
  const { lang } = useI18n()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('sale')
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const text = useMemo(() => lang === 'ru'
    ? {
        results: 'Объявления по вашему запросу',
        found: 'найдено',
        loading: 'Поиск...',
        empty: 'Объявлений по этому запросу не найдено.',
        all: 'Показать все объявления',
        mortgage: 'Ипотека',
        trusted: 'Надёжный профиль',
        rooms: 'комн.',
        area: 'м²',
      }
    : {
        results: 'Sizning so‘rovingiz bo‘yicha e’lonlar',
        found: 'ta topildi',
        loading: 'Qidirilmoqda...',
        empty: 'Bu so‘rov bo‘yicha e’lon topilmadi.',
        all: 'Barcha e’lonlarni ko‘rish',
        mortgage: 'Ipoteka',
        trusted: 'Ishonchli profil',
        rooms: 'xona',
        area: 'm²',
      }, [lang])

  useEffect(() => {
    let cancelled = false

    const mount = () => {
      const host = document.querySelector<HTMLElement>('[data-royalhouse-mobile-search]')
      if (!host) return false

      const input = host.querySelector<HTMLInputElement>('input[aria-label]')
      inputRef.current = input
      if (!input) return false

      const handleInput = () => {
        setQuery(input.value)
      }

      const handleClick = (event: Event) => {
        const target = event.target as HTMLElement | null
        const button = target?.closest('button')
        if (!button || !host.contains(button)) return

        const svg = button.querySelector('svg')
        const isSearchButton = Boolean(svg && button.className.includes('bg-emerald-600') && !button.className.includes('shrink-0 rounded-lg'))
        if (isSearchButton) {
          event.preventDefault()
          event.stopPropagation()
          setQuery(input.value)
        }

        const label = button.textContent?.trim().toLocaleLowerCase('uz-UZ') || ''
        if (label === 'sotuv' || label === 'продажа') setTab('sale')
        else if (label === 'ijara' || label === 'аренда') setTab('rent')
        else if (label === 'kunlik' || label === 'посуточно') setTab('daily')
        else if (label === 'yangi uylar' || label === 'новостройки') setTab('new')
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' || document.activeElement !== input) return
        event.preventDefault()
        event.stopPropagation()
        setQuery(input.value)
      }

      input.addEventListener('input', handleInput)
      host.addEventListener('click', handleClick, true)
      input.addEventListener('keydown', handleKeyDown, true)

      return () => {
        input.removeEventListener('input', handleInput)
        host.removeEventListener('click', handleClick, true)
        input.removeEventListener('keydown', handleKeyDown, true)
      }
    }

    let cleanup = mount()
    const observer = new MutationObserver(() => {
      if (cleanup || cancelled) return
      cleanup = mount()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelled = true
      observer.disconnect()
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    abortRef.current?.abort()

    const value = query.trim()
    if (!value) {
      setItems([])
      setTotal(null)
      setSearched(false)
      setLoading(false)
      return
    }

    timer.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setSearched(true)

      try {
        const filters = parseQuery(value, tab)
        const response = await fetch(`/api/listings/search?${toParams(filters).toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'SEARCH_FAILED')
        setItems(Array.isArray(result.data) ? result.data : [])
        setTotal(typeof result.pagination?.total === 'number' ? result.pagination.total : null)
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          setItems([])
          setTotal(null)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 350)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query, tab])

  if (!searched) return null

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-2 sm:px-5" data-royalhouse-inline-results>
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-slate-900">{text.results}</h2>
            {!loading && total !== null && <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{total} {text.found}</p>}
          </div>
          {loading && <span className="text-[10px] font-bold text-emerald-600">{text.loading}</span>}
        </div>

        {loading && items.length === 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : items.length ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => {
                const title = lang === 'ru' ? (item.title_ru || item.title) : item.title
                const location = [item.city, item.district].filter(Boolean).join(', ')
                return (
                  <Link key={item.id} href={`/listings/${item.id}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white transition active:scale-[.99]">
                    <div className="relative aspect-[1.18] bg-slate-100">
                      {item.primary_image?.image_url ? (
                        <img src={item.primary_image.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-400">Royalhouse</div>}
                      {item.effective_promotion_badge && <span className="absolute left-1.5 top-1.5 rounded-md bg-amber-400 px-1.5 py-0.5 text-[8px] font-black text-slate-950">{item.effective_promotion_badge}</span>}
                    </div>
                    <div className="p-2">
                      <div className="text-sm font-black leading-tight text-slate-900">{formatPrice(item.price, item.currency, lang)}</div>
                      <div className="mt-0.5 truncate text-[11px] font-bold text-slate-800">{title}</div>
                      <div className="mt-1 truncate text-[10px] font-semibold text-slate-400">📍 {location}</div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-bold text-slate-500">
                        {item.rooms ? <span>{item.rooms} {text.rooms}</span> : null}
                        {item.area_m2 ? <span>· {item.area_m2} {text.area}</span> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.property_type && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold text-slate-500">{propertyLabel(item.property_type, lang)}</span>}
                        {item.is_mortgage_available && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700">{text.mortgage}</span>}
                        {item.is_trusted_seller && <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[8px] font-bold text-sky-700">✓ {text.trusted}</span>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
            <Link href={`/listings?${toParams(parseQuery(valueForLink(query), tab)).toString()}`} className="mt-3 block text-center text-xs font-black text-emerald-700">
              {text.all} →
            </Link>
          </>
        ) : (
          <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-xs font-semibold text-slate-500">{text.empty}</div>
        )}
      </div>
    </div>
  )
}

function valueForLink(value: string) {
  return value
}
