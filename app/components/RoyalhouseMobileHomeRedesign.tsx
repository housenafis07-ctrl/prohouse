'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'
import { useI18n } from './I18nProvider'

type Tab = 'sale' | 'rent' | 'daily' | 'new'

type SmartFilters = {
  tab?: Tab
  region?: string
  district?: string
  type?: string
  rooms?: string
  min?: string
  max?: string
  currency?: string
  area?: string
}

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('uz-UZ')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

function parseSmartQuery(input: string): SmartFilters {
  const q = normalize(input)
  const result: SmartFilters = {}

  if (/\b(ijara|ijaraga|rent|аренда|снять|сниму)\b/.test(q)) result.tab = 'rent'
  if (/\b(kunlik|sutkalik|dacha|дача|посут|сутки)\b/.test(q)) result.tab = 'daily'
  if (/\b(yangi bino|yangi uy|novostroy|новострой|новое здание)\b/.test(q)) result.tab = 'new'

  const room = q.match(/(\d+)\s*(xona|xonali|komna|комн|комнат)/i)
  if (room) result.rooms = room[1]

  const area = q.match(/(\d+)\s*(m2|m²|м2|кв\.?\s*м)/i)
  if (area) result.area = area[1]

  const billion = q.match(/(\d+(?:[.,]\d+)?)\s*(mlrd|milliard|млрд)/i)
  const million = q.match(/(\d+(?:[.,]\d+)?)\s*(mln|million|млн)/i)
  const thousand = q.match(/(\d+(?:[.,]\d+)?)\s*(ming|тыс)/i)
  const usd = q.match(/(\d+(?:[.,]\d+)?)\s*(ming\s*\$|ming\s*y\.e|тыс\s*\$|\$)/i)

  if (usd) {
    result.currency = 'USD'
    const amount = Number(usd[1].replace(',', '.'))
    result.max = String(usd[2].includes('ming') || usd[2].includes('тыс') ? Math.round(amount * 1000) : Math.round(amount))
  } else if (billion) {
    result.currency = 'UZS'
    result.max = String(Math.round(Number(billion[1].replace(',', '.')) * 1_000_000_000))
  } else if (million) {
    result.currency = 'UZS'
    result.max = String(Math.round(Number(million[1].replace(',', '.')) * 1_000_000))
  } else if (thousand) {
    result.currency = 'UZS'
    result.max = String(Math.round(Number(thousand[1].replace(',', '.')) * 1_000))
  }

  const locations = UZBEKISTAN_LOCATIONS.flatMap((location) => [
    { name: location.name, type: 'region' as const },
    ...location.districts.map((district) => ({ name: district, type: 'district' as const })),
  ])

  const match = locations
    .sort((a, b) => b.name.length - a.name.length)
    .find((location) => q.includes(normalize(location.name)))

  if (match) {
    if (match.type === 'region') result.region = match.name
    else result.district = match.name
  }

  if (/\b(kvartira|kvartiraga|квартира|апартамент|apartment)\b/.test(q)) result.type = 'apartment'
  else if (/\b(hovli|uy|xususiy uy|дом|коттедж|house)\b/.test(q)) result.type = 'house'
  else if (/\b(yer|uchastka|земля|участок)\b/.test(q)) result.type = 'land'
  else if (/\b(tijorat|commercial|коммерц)\b/.test(q)) result.type = 'commercial'

  return result
}

function buildSearchUrl(filters: SmartFilters) {
  const params = new URLSearchParams()
  const tab = filters.tab || 'sale'
  params.set('tab', tab === 'new' ? 'sale' : tab)
  if (filters.tab === 'new') params.set('type', 'new_building')
  if (filters.region) params.set('region', filters.region)
  if (filters.district) params.set('district', filters.district)
  if (filters.type) params.set('type', filters.type)
  if (filters.rooms) params.set('rooms', filters.rooms)
  if (filters.area) params.set('min_area', filters.area)
  if (filters.currency) params.set('currency', filters.currency)
  if (filters.min) params.set('min', filters.min)
  if (filters.max) params.set('max', filters.max)
  if (filters.type === 'rent_dacha') {
    params.set('taxonomy', 'rent_dacha')
    params.set('tab', 'daily')
  }
  return `/listings?${params.toString()}`
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  )
}

function SparkIcon() {
  return <span aria-hidden="true" className="rh-ai-spark">✦</span>
}

export default function RoyalhouseMobileHomeRedesign() {
  const { lang } = useI18n()
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('sale')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [region, setRegion] = useState('')
  const [district, setDistrict] = useState('')
  const [type, setType] = useState('')
  const [rooms, setRooms] = useState('')
  const [area, setArea] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  useEffect(() => {
    const hero = document.querySelector('section[aria-label*="Royalhouse"]')
    if (!hero?.parentElement) return

    const node = document.createElement('div')
    node.setAttribute('data-royalhouse-mobile-search', 'true')
    hero.parentElement.insertBefore(node, hero)
    setHost(node)

    return () => {
      node.remove()
    }
  }, [])

  const districts = useMemo(
    () => (region ? UZBEKISTAN_LOCATIONS.find((item) => item.name === region)?.districts ?? [] : []),
    [region],
  )

  const text = lang === 'ru'
    ? {
        searchPlaceholder: 'Например: 3-комнатная квартира в Ташкенте до 1 млрд',
        search: 'Найти',
        filters: 'Подробный фильтр',
        sale: 'Продажа',
        rent: 'Аренда',
        daily: 'Посуточно',
        new: 'Новостройки',
        smart: 'Умный поиск',
        filterTitle: 'Параметры поиска',
        region: 'Город / область',
        district: 'Район',
        type: 'Тип',
        rooms: 'Комнаты',
        area: 'Площадь, м²',
        maxPrice: 'Максимальная цена, сум',
        all: 'Все',
        apply: 'Применить',
        close: 'Закрыть',
      }
    : {
        searchPlaceholder: 'Masalan: Toshkentda 3 xonali kvartira 1 mlrdgacha',
        search: 'Qidirish',
        filters: 'Batafsil filtr',
        sale: 'Sotuv',
        rent: 'Ijara',
        daily: 'Kunlik',
        new: 'Yangi uylar',
        smart: 'Aqlli qidiruv',
        filterTitle: 'Qidiruv parametrlari',
        region: 'Shahar / viloyat',
        district: 'Tuman',
        type: 'Turi',
        rooms: 'Xonalar',
        area: 'Maydon, m²',
        maxPrice: 'Maksimal narx, so‘m',
        all: 'Barchasi',
        apply: 'Qo‘llash',
        close: 'Yopish',
      }

  const runSearch = (smart = false) => {
    const parsed = smart ? parseSmartQuery(query) : {}
    const next: SmartFilters = {
      ...parsed,
      tab: parsed.tab || tab,
      region: parsed.region || region,
      district: parsed.district || district,
      type: parsed.type || type,
      rooms: parsed.rooms || rooms,
      area: parsed.area || area,
      max: parsed.max || (maxPrice ? maxPrice.replace(/\D/g, '') : undefined),
      currency: parsed.currency || (maxPrice ? 'UZS' : undefined),
    }
    window.location.assign(buildSearchUrl(next))
  }

  const setSearchTab = (next: Tab) => {
    setTab(next)
    if (next === 'new') setType('new_building')
    else if (type === 'new_building') setType('')
  }

  const content = (
    <>
      <style>{`
        [data-royalhouse-mobile-search] { display:block; position:relative; z-index:40; }
        @media (min-width:768px) {
          [data-royalhouse-mobile-search] { display:none !important; }
        }
        @media (max-width:767px) {
          header a[href^="tel:"] span, header a[href*="t.me"] span { display:none !important; }
          header a[href^="tel:"], header a[href*="t.me"] {
            width:44px !important; min-width:44px !important; height:44px !important;
            padding:0 !important; border-radius:14px !important;
          }
          section[aria-label*="Royalhouse reklama"] > div > div,
          section[aria-label*="Royalhouse reklama"] [class*="min-h-[600px]"],
          section[aria-label*="Royalhouse reklama"] [class*="min-h-[560px]"],
          section[aria-label*="Royalhouse reklama"] [class*="min-h-[540px]"] {
            min-height:360px !important; height:360px !important;
          }
          section[aria-label*="Royalhouse reklama"] [class*="mt-36"] {
            margin-top:24px !important; margin-bottom:0 !important;
          }
          section[class*="-mt-28"] { display:none !important; }
          section .grid[class*="md:grid-cols-3"],
          section .grid[class*="md:grid-cols-4"] {
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
            gap:10px !important;
          }
          section .grid[class*="md:grid-cols-3"] > a,
          section .grid[class*="md:grid-cols-4"] > a {
            border-radius:14px !important;
          }
          section .grid[class*="md:grid-cols-3"] > a > div:last-child,
          section .grid[class*="md:grid-cols-4"] > a > div:last-child {
            padding:10px !important;
          }
          section .grid[class*="md:grid-cols-3"] h3,
          section .grid[class*="md:grid-cols-4"] h3 {
            font-size:15px !important; line-height:1.15 !important;
          }
          section .grid[class*="md:grid-cols-3"] p,
          section .grid[class*="md:grid-cols-4"] p {
            font-size:11px !important; line-height:1.25 !important;
          }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1400px] px-3 py-2 sm:px-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="mb-2 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
            {([['sale', text.sale], ['rent', text.rent], ['daily', text.daily], ['new', text.new]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSearchTab(value)}
                className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-black transition ${tab === value ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') runSearch(true) }}
                placeholder={text.searchPlaceholder}
                aria-label={text.smart}
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400"
              />
              <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 sm:inline-flex">
                <SparkIcon /> AI
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-label={text.filters}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
            >
              <SlidersIcon />
            </button>
            <button
              type="button"
              onClick={() => runSearch(true)}
              aria-label={text.search}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"
            >
              <SearchIcon />
            </button>
          </div>

          <div className="mt-1.5 flex items-center gap-1 px-1 text-[9px] font-semibold text-slate-400">
            <SparkIcon />
            <span>{text.smart}: {lang === 'ru' ? 'понимает район, комнаты, площадь и бюджет' : 'tuman, xona, maydon va budjetni tushunadi'}</span>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[120] flex items-end bg-slate-950/50 p-0 backdrop-blur-sm" onClick={() => setFiltersOpen(false)}>
          <div className="w-full rounded-t-3xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">{text.filterTitle}</h2>
              <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">×</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold">
                <span className="block text-[10px] text-slate-400">{text.region}</span>
                <select value={region} onChange={(event) => { setRegion(event.target.value); setDistrict('') }} className="mt-1 w-full bg-transparent outline-none">
                  <option value="">{text.all}</option>
                  {UZBEKISTAN_LOCATIONS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
              </label>
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold">
                <span className="block text-[10px] text-slate-400">{text.district}</span>
                <select value={district} onChange={(event) => setDistrict(event.target.value)} disabled={!region} className="mt-1 w-full bg-transparent outline-none disabled:text-slate-400">
                  <option value="">{text.all}</option>
                  {districts.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold">
                <span className="block text-[10px] text-slate-400">{text.type}</span>
                <select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 w-full bg-transparent outline-none">
                  <option value="">{text.all}</option>
                  <option value="apartment">{lang === 'ru' ? 'Квартира' : 'Kvartira'}</option>
                  <option value="house">{lang === 'ru' ? 'Дом' : 'Uy'}</option>
                  <option value="land">{lang === 'ru' ? 'Земля' : 'Yer'}</option>
                  <option value="commercial">{lang === 'ru' ? 'Коммерция' : 'Tijorat'}</option>
                  <option value="rent_dacha">{lang === 'ru' ? 'Дача' : 'Dacha'}</option>
                  <option value="new_building">{lang === 'ru' ? 'Новостройка' : 'Yangi bino'}</option>
                </select>
              </label>
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold">
                <span className="block text-[10px] text-slate-400">{text.rooms}</span>
                <select value={rooms} onChange={(event) => setRooms(event.target.value)} className="mt-1 w-full bg-transparent outline-none">
                  <option value="">{text.all}</option>
                  {[1, 2, 3, 4, 5, 6].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold">
                <span className="block text-[10px] text-slate-400">{text.area}</span>
                <input value={area} onChange={(event) => setArea(event.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="70" className="mt-1 w-full bg-transparent outline-none" />
              </label>
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold">
                <span className="block text-[10px] text-slate-400">{text.maxPrice}</span>
                <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="1 000 000 000" className="mt-1 w-full bg-transparent outline-none" />
              </label>
            </div>
            <button type="button" onClick={() => runSearch(false)} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white">
              <SearchIcon /> {text.apply}
            </button>
            <button type="button" onClick={() => setFiltersOpen(false)} className="mt-2 w-full py-2 text-xs font-bold text-slate-500">{text.close}</button>
          </div>
        </div>
      )}
    </>
  )

  if (!host) return null
  return createPortal(content, host)
}
