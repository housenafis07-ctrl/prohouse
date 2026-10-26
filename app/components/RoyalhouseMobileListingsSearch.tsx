'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
}
function SparkIcon() { return <span aria-hidden="true">✦</span> }

type Result = { id: string; title: string; title_ru?: string | null; price?: number | null; currency?: string | null; area_m2?: number | null; rooms?: number | null; city?: string | null; district?: string | null; primary_image?: { image_url?: string | null } | null }
type Filters = { tab?: 'sale' | 'rent' | 'daily'; q?: string; city?: string; district?: string; property_type?: string; property_scope?: string; rooms?: number | null; min?: number | null; max?: number | null; currency?: string; min_area?: number | null; sort?: string }

function buildUrl(filters: Filters, fallbackTab: string) {
  const params = new URLSearchParams()
  params.set('tab', filters.tab || (fallbackTab === 'rent' || fallbackTab === 'daily' ? fallbackTab : 'sale'))
  if (filters.q) params.set('q', filters.q)
  if (filters.city) params.set('city', filters.city)
  if (filters.district) params.set('district', filters.district)
  if (filters.property_type) params.set('property_type', filters.property_type)
  if (filters.property_scope) params.set('property_scope', filters.property_scope)
  if (filters.rooms != null) params.set('rooms', String(filters.rooms))
  if (filters.min != null) params.set('min', String(filters.min))
  if (filters.max != null) params.set('max', String(filters.max))
  if (filters.currency) params.set('currency', filters.currency)
  if (filters.min_area != null) params.set('min_area', String(filters.min_area))
  if (filters.sort) params.set('sort', filters.sort)
  return `/listings?${params.toString()}`
}

export default function RoyalhouseMobileListingsSearch() {
  const pathname = usePathname()
  const [tab, setTab] = useState('sale')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [filters, setFilters] = useState<Filters | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (pathname !== '/listings') return
    const currentTab = new URLSearchParams(window.location.search).get('tab') || 'sale'
    setTab(currentTab)
    document.body.classList.add('rh-mobile-listings')
    return () => document.body.classList.remove('rh-mobile-listings')
  }, [pathname])

  if (pathname !== '/listings') return null

  const localeRu = typeof document !== 'undefined' && document.documentElement.lang === 'ru'

  const search = async (submit = false) => {
    const value = query.trim()
    if (!value) return
    setLoading(true)
    try {
      const response = await fetch('/api/ai/property-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: value, tab, all: true }), cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'AI qidiruv xatosi.')
      const nextFilters = (payload?.filters || {}) as Filters
      setFilters(nextFilters)
      setResults(Array.isArray(payload?.data) ? payload.data.slice(0, 6) : [])
      if (submit) window.location.assign(buildUrl(nextFilters, tab))
    } catch {
      setResults([])
      setFilters(null)
    } finally {
      setLoading(false)
    }
  }

  return <>
    <style>{`@media (max-width:767px){body.rh-mobile-listings aside{display:none!important}}@media (min-width:768px){.rh-mobile-listings-search{display:none!important}}`}</style>
    <div className="rh-mobile-listings-search mx-auto w-full max-w-[1440px] px-3 pt-2 sm:px-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
            <SearchIcon />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void search(true) }} placeholder={localeRu ? 'Например: 3-комнатная квартира в Ташкенте до 1 млрд' : 'Masalan: Toshkentda 3 xonali kvartira 1 mlrdgacha'} aria-label={localeRu ? 'Умный поиск' : 'Aqlli qidiruv'} className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400" />
            <span className="hidden items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 sm:inline-flex"><SparkIcon /> AI</span>
          </div>
          <button type="button" onClick={() => void search(true)} aria-label={localeRu ? 'Найти' : 'Qidirish'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><SearchIcon /></button>
        </div>
        <div className="mt-1.5 flex items-center gap-1 px-1 text-[9px] font-semibold text-slate-400"><SparkIcon /><span>{localeRu ? 'Умный поиск понимает район, комнаты, площадь и бюджет' : 'Aqlli qidiruv tuman, xona, maydon va budjetni tushunadi'}</span></div>
        {(loading || results.length > 0 || filters) && <div className="mt-2 overflow-hidden rounded-xl border border-slate-100 bg-white">
          {loading && <div className="px-3 py-2 text-[11px] font-semibold text-slate-400">✦ AI e’lonlarni izlamoqda…</div>}
          {!loading && results.length > 0 && <div className="divide-y divide-slate-100">
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500">✦ AI qidiruv natijalari</div>
            {results.map((item) => <button key={item.id} type="button" onClick={() => window.location.assign(`/listings/${encodeURIComponent(item.id)}`)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50"><div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">{item.primary_image?.image_url && <img src={item.primary_image.image_url} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-black">{localeRu ? item.title_ru || item.title : item.title}</div><div className="mt-0.5 truncate text-[10px] text-slate-500">{[item.city, item.district, item.rooms ? `${item.rooms} xona` : '', item.area_m2 ? `${item.area_m2} m²` : ''].filter(Boolean).join(' · ')}</div></div><span className="text-slate-300">›</span></button>)}
            <button type="button" onClick={() => filters && window.location.assign(buildUrl(filters, tab))} className="w-full px-3 py-2.5 text-center text-[11px] font-black text-emerald-700 hover:bg-emerald-50">Barcha mos e’lonlarni ko‘rish →</button>
          </div>}
          {!loading && query.trim() && results.length === 0 && <div className="px-3 py-3 text-[11px] font-semibold text-slate-400">Mos e’lon topilmadi.</div>}
        </div>}
      </div>
    </div>
  </>
}
