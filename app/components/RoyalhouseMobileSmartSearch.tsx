'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'
import { useI18n } from './I18nProvider'
import { formatMoney } from '@/lib/money'

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

type SearchListing = {
  id: string
  title: string
  title_ru?: string | null
  listing_type: string
  property_type?: string | null
  price: number
  currency: string
  area_m2?: number | null
  rooms?: number | null
  district?: string | null
  city?: string | null
  primary_image?: { image_url: string } | null
  effective_promotion_badge?: string | null
}

const normalize = (value: string) => value.toLocaleLowerCase('uz-UZ').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim()

function parseSmartQuery(input: string): SmartFilters {
  const q = normalize(input)
  const result: SmartFilters = {}

  if (/\b(ijara|ijaraga|rent|аренда|снять|сниму)\b/.test(q)) result.tab = 'rent'
  if (/\b(kunlik|sutkalik|dacha|dachalar|дача|посут|сутки)\b/.test(q)) result.tab = 'daily'
  if (/\b(yangi bino|yangi uy|novostroy|новострой|новое здание)\b/.test(q)) result.tab = 'new'

  const room = q.match(/\b(\d+)\s*(xona|xonali|xonalik|komna|комн|комнат)\b/i)
  if (room) result.rooms = room[1]

  const area = q.match(/\b(\d+)\s*(m2|m²|м2|кв\.?\s*м)\b/i)
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
  const match = locations.sort((a, b) => b.name.length - a.name.length).find((location) => q.includes(normalize(location.name)))
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

function buildParams(filters: SmartFilters) {
  const params = new URLSearchParams()
  const tab = filters.tab || 'sale'
  params.set('tab', tab === 'new' ? 'sale' : tab)
  params.set('limit', '24')
  if (filters.tab === 'new') params.set('listing_type', 'new_building')
  if (filters.region) params.set('region', filters.region)
  if (filters.district) params.set('district', filters.district)
  if (filters.type) {
    if (filters.type === 'new_building') params.set('listing_type', 'new_building')
    else if (filters.type === 'rent_dacha') params.set('taxonomy', 'rent_dacha')
    else params.set('property_type', filters.type)
  }
  if (filters.rooms) params.set('rooms_exact', filters.rooms)
  if (filters.area) params.set('min_area', filters.area)
  if (filters.currency) params.set('currency', filters.currency)
  if (filters.min) params.set('min', filters.min)
  if (filters.max) params.set('max', filters.max)
  return params
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
}

function SlidersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></svg>
}

function SparkIcon() { return <span aria-hidden="true">✦</span> }

export default function RoyalhouseMobileSmartSearch() {
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
  const [results, setResults] = useState<SearchListing[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const hero = document.querySelector('section[aria-label*="Royalhouse"]')
    if (!hero?.parentElement) return
    const node = document.createElement('div')
    node.setAttribute('data-royalhouse-mobile-search', 'true')
    hero.parentElement.insertBefore(node, hero)
    setHost(node)
    return () => node.remove()
  }, [])

  const districts = useMemo(() => region ? UZBEKISTAN_LOCATIONS.find((item) => item.name === region)?.districts ?? [] : [], [region])

  const text = lang === 'ru'
    ? {
        placeholder: 'Например: 3-комнатная квартира в Сергели до 800 млн', search: 'Найти', filters: 'Подробный фильтр', sale: 'Продажа', rent: 'Аренда', daily: 'Посуточно', new: 'Новостройки', smart: 'Умный поиск', filterTitle: 'Параметры поиска', region: 'Город / область', district: 'Район', type: 'Тип', rooms: 'Комнаты', area: 'Площадь, м²', maxPrice: 'Максимальная цена, сум', all: 'Все', apply: 'Применить', close: 'Закрыть', found: 'объявлений найдено', loading: 'Поиск...', empty: 'По вашему запросу объявлений нет.'
      }
    : {
        placeholder: 'Masalan: Sergelida 3 xonali kvartira 800 mln gacha', search: 'Qidirish', filters: 'Batafsil filtr', sale: 'Sotuv', rent: 'Ijara', daily: 'Kunlik', new: 'Yangi uylar', smart: 'Aqlli qidiruv', filterTitle: 'Qidiruv parametrlari', region: 'Shahar / viloyat', district: 'Tuman', type: 'Turi', rooms: 'Xonalar', area: 'Maydon, m²', maxPrice: 'Maksimal narx, so‘m', all: 'Barchasi', apply: 'Qo‘llash', close: 'Yopish', found: 'ta e’lon topildi', loading: 'Qidirilmoqda...', empty: 'So‘rovingiz bo‘yicha e’lon topilmadi.'
      }

  async function runSearch(smart = true) {
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

    if (next.tab) setTab(next.tab)
    if (next.region) setRegion(next.region)
    if (next.district) setDistrict(next.district)
    if (next.type) setType(next.type)
    if (next.rooms) setRooms(next.rooms)
    if (next.area) setArea(next.area)
    if (next.max) setMaxPrice(next.max)

    setLoading(true)
    setSearched(true)
    setError('')
    try {
      const response = await fetch(`/api/listings/search?${buildParams(next).toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Search failed')
      setResults(Array.isArray(payload?.data) ? payload.data : [])
      setTotal(typeof payload?.pagination?.total === 'number' ? payload.pagination.total : null)
    } catch {
      setResults([])
      setTotal(0)
      setError('Qidiruvda xatolik yuz berdi.')
    } finally {
      setLoading(false)
    }
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
        @media (min-width:768px) { [data-royalhouse-mobile-search] { display:none !important; } }
        @media (max-width:767px) {
          [data-royalhouse-mobile-search] svg { width:18px; height:18px; flex:0 0 18px; }
          [data-royalhouse-mobile-search] input { min-width:0; width:100%; font-size:12px; line-height:18px; }
          [data-royalhouse-mobile-search] button[data-search-button] { width:42px; height:42px; min-width:42px; padding:0; border-radius:13px; }
          [data-rh-search-results] img { aspect-ratio:4/3; object-fit:cover; }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1400px] px-3 py-2 sm:px-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="mb-2 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
            {([['sale', text.sale], ['rent', text.rent], ['daily', text.daily], ['new', text.new]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setSearchTab(value)} className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-black ${tab === value ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'}`}>{label}</button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
              <SearchIcon />
              <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void runSearch(true) } }} placeholder={text.placeholder} aria-label={text.smart} className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400" />
              <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 sm:inline-flex"><SparkIcon /> AI</span>
            </div>
            <button type="button" onClick={() => setFiltersOpen(true)} aria-label={text.filters} data-search-button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"><SlidersIcon /></button>
            <button type="button" onClick={() => void runSearch(true)} aria-label={text.search} data-search-button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><SearchIcon /></button>
          </div>

          <div className="mt-1.5 flex items-center gap-1 px-1 text-[9px] font-semibold text-slate-400"><SparkIcon /><span>{text.smart}: {lang === 'ru' ? 'понимает район, комнаты, тип и бюджет' : 'tuman, xona, tur va budjetni tushunadi'}</span></div>
        </div>

        {searched && (
          <div data-rh-search-results className="mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-sm font-black text-slate-800">{loading ? text.loading : `${total ?? results.length} ${text.found}`}</div>
              {error && <div className="text-[10px] font-bold text-red-600">{error}</div>}
            </div>
            {!loading && !error && results.length === 0 && <div className="px-2 py-5 text-center text-sm font-semibold text-slate-400">{text.empty}</div>}
            {!loading && results.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {results.map((item) => (
                  <a key={item.id} href={`/listings/${item.id}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="relative overflow-hidden bg-slate-100">
                      {item.primary_image?.image_url ? <img src={item.primary_image.image_url} alt="" className="w-full object-cover" loading="lazy" /> : <div className="aspect-[4/3] w-full" />}
                    </div>
                    <div className="p-2">
                      <div className="text-sm font-black text-slate-900">{formatMoney(item.price, item.currency, lang === 'ru' ? 'ru' : 'uz')}</div>
                      <div className="mt-0.5 line-clamp-2 text-xs font-bold text-slate-700">{lang === 'ru' ? (item.title_ru || item.title) : item.title}</div>
                      <div className="mt-1 truncate text-[10px] font-semibold text-slate-400">{[item.district, item.city].filter(Boolean).join(' · ')}{item.rooms ? ` · ${item.rooms} xona` : ''}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[120] flex items-end bg-slate-950/50 p-0 backdrop-blur-sm" onClick={() => setFiltersOpen(false)}>
          <div className="w-full rounded-t-3xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200" />
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">{text.filterTitle}</h2><button type="button" onClick={() => setFiltersOpen(false)} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">×</button></div>
            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold"><span className="block text-[10px] text-slate-400">{text.region}</span><select value={region} onChange={(event) => { setRegion(event.target.value); setDistrict('') }} className="mt-1 w-full bg-transparent outline-none"><option value="">{text.all}</option>{UZBEKISTAN_LOCATIONS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold"><span className="block text-[10px] text-slate-400">{text.district}</span><select value={district} onChange={(event) => setDistrict(event.target.value)} disabled={!region} className="mt-1 w-full bg-transparent outline-none disabled:text-slate-400"><option value="">{text.all}</option>{districts.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold"><span className="block text-[10px] text-slate-400">{text.type}</span><select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 w-full bg-transparent outline-none"><option value="">{text.all}</option><option value="apartment">{lang === 'ru' ? 'Квартира' : 'Kvartira'}</option><option value="house">{lang === 'ru' ? 'Дом' : 'Uy'}</option><option value="land">{lang === 'ru' ? 'Земля' : 'Yer'}</option><option value="commercial">{lang === 'ru' ? 'Коммерция' : 'Tijorat'}</option><option value="rent_dacha">{lang === 'ru' ? 'Дача' : 'Dacha'}</option><option value="new_building">{lang === 'ru' ? 'Новостройка' : 'Yangi bino'}</option></select></label>
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold"><span className="block text-[10px] text-slate-400">{text.rooms}</span><select value={rooms} onChange={(event) => setRooms(event.target.value)} className="mt-1 w-full bg-transparent outline-none"><option value="">{text.all}</option>{[1,2,3,4,5,6].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold"><span className="block text-[10px] text-slate-400">{text.area}</span><input value={area} onChange={(event) => setArea(event.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="70" className="mt-1 w-full bg-transparent outline-none" /></label>
              <label className="rounded-xl bg-slate-50 p-3 text-xs font-bold"><span className="block text-[10px] text-slate-400">{text.maxPrice}</span><input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="800000000" className="mt-1 w-full bg-transparent outline-none" /></label>
            </div>
            <button type="button" onClick={() => { setFiltersOpen(false); void runSearch(false) }} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white"><SearchIcon /> {text.apply}</button>
            <button type="button" onClick={() => setFiltersOpen(false)} className="mt-2 w-full py-2 text-xs font-bold text-slate-500">{text.close}</button>
          </div>
        </div>
      )}
    </>
  )

  if (!host) return null
  return createPortal(content, host)
}
