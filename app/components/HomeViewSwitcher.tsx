'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import ListingResultsMap from '@/app/components/ListingResultsMap'
import { formatMoney } from '@/lib/money'

const views = [
  { key: 'list', icon: 'list' },
  { key: 'grid', icon: 'grid' },
  { key: 'table', icon: 'table' },
] as const

type ViewKey = (typeof views)[number]['key'] | 'map'
type HomeListing = {
  id: string
  title: string
  title_ru?: string | null
  price: number
  currency: string
  city: string | null
  district: string | null
  area_m2: number | null
  rooms: number | null
  latitude: number | null
  longitude: number | null
}

function Icon({ type }: { type: (typeof views)[number]['icon'] }) {
  if (type === 'list') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" /><path d="M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeWidth="3" /></svg>
  if (type === 'grid') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16M15 4v16" /></svg>
}

function MapIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><path d="M12 21s7-6.1 7-12A7 7 0 1 0 5 9c0 5.9 7 12 7 12Z" /><circle cx="12" cy="9" r="2.2" /></svg>
}

export default function HomeViewSwitcher({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const [active, setActive] = useState<ViewKey>('grid')
  const [listings, setListings] = useState<HomeListing[]>([])
  const [loading, setLoading] = useState(false)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const hiddenNodesRef = useRef<HTMLElement[]>([])

  const restoreHomeContent = () => {
    hiddenNodesRef.current.forEach((node) => {
      node.style.removeProperty('display')
      node.removeAttribute('aria-hidden')
    })
    hiddenNodesRef.current = []
  }

  const isolateHomeView = (view: ViewKey) => {
    restoreHomeContent()
    if (view === 'grid' || !hostRef.current) return
    const main = hostRef.current.closest('main')
    if (!main) return

    let branch: HTMLElement = hostRef.current
    while (branch.parentElement && branch.parentElement !== main) branch = branch.parentElement
    if (branch.parentElement !== main) return

    let next = branch.nextElementSibling as HTMLElement | null
    while (next) {
      hiddenNodesRef.current.push(next)
      next.style.setProperty('display', 'none', 'important')
      next.setAttribute('aria-hidden', 'true')
      next = next.nextElementSibling as HTMLElement | null
    }
  }

  const loadListings = async () => {
    setLoading(true)
    try {
      const db = createClient()
      const { data, error } = await db
        .from('listing_search')
        .select('id,title,title_ru,price,currency,city,district,area_m2,rooms,latitude,longitude')
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setListings((data || []) as HomeListing[])
    } catch {
      setListings([])
    } finally {
      setLoading(false)
    }
  }

  const selectView = (view: ViewKey) => {
    setActive(view)
    window.dispatchEvent(new CustomEvent('royalhouse-home-view-change', { detail: { view } }))
    isolateHomeView(view)
    if (view !== 'grid' && listings.length === 0 && !loading) void loadListings()
  }

  useEffect(() => () => restoreHomeContent(), [])

  const label = (key: ViewKey) => {
    if (key === 'list') return lang === 'ru' ? 'Список' : 'Ro‘yxat'
    if (key === 'grid') return lang === 'ru' ? 'Сетка' : 'Znachki'
    if (key === 'table') return lang === 'ru' ? 'Таблица' : 'Jadval'
    return lang === 'ru' ? 'В карте' : 'Xaritada'
  }

  const title = (item: HomeListing) => lang === 'ru' ? (item.title_ru || item.title) : item.title
  const location = (item: HomeListing) => [item.city, item.district].filter(Boolean).join(', ')

  return (
    <div ref={hostRef} data-royalhouse-view-switcher className="mx-auto max-w-[1400px] px-4 pt-7 sm:pt-8">
      <div className="flex w-fit items-center rounded-2xl bg-[#ffd51a] p-1.5 shadow-sm sm:rounded-full">
        <div className="flex items-center gap-1">
          {views.map((view) => <button key={view.key} type="button" onClick={() => selectView(view.key)} aria-label={label(view.key)} title={label(view.key)} aria-pressed={active === view.key} className={`flex h-11 w-11 items-center justify-center rounded-xl text-slate-900/80 transition hover:bg-white/50 sm:h-10 sm:w-10 sm:rounded-full ${active === view.key ? 'bg-white/55' : ''}`}><Icon type={view.icon} /></button>)}
        </div>
        <div className="ml-1 border-l border-slate-900/20 pl-1">
          <button type="button" onClick={() => selectView('map')} aria-label={label('map')} title={label('map')} aria-pressed={active === 'map'} className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-slate-900 transition hover:bg-white/50 sm:h-10 sm:rounded-full sm:px-4 ${active === 'map' ? 'bg-white/55' : ''}`}><MapIcon /><span>{label('map')}</span></button>
        </div>
      </div>

      {active !== 'grid' && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {active === 'map' ? (
            <div className="h-[620px]"><ListingResultsMap listings={listings.map((item) => ({ id: item.id, title: title(item), price: item.price, currency: item.currency, latitude: item.latitude, longitude: item.longitude }))} /></div>
          ) : active === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">{lang === 'ru' ? 'Объявление' : 'E’lon'}</th><th className="px-5 py-4">{lang === 'ru' ? 'Цена' : 'Narx'}</th><th className="px-5 py-4">{lang === 'ru' ? 'Расположение' : 'Joylashuv'}</th><th className="px-5 py-4">{lang === 'ru' ? 'Площадь' : 'Maydon'}</th><th className="px-5 py-4">{lang === 'ru' ? 'Комнаты' : 'Xonalar'}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{listings.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-bold text-slate-900"><a href={`/listings/${item.id}`} className="hover:text-emerald-600">{title(item)}</a></td><td className="whitespace-nowrap px-5 py-4 font-black text-emerald-600">{formatMoney(item.price, item.currency, lang)}</td><td className="px-5 py-4 text-sm text-slate-600">{location(item) || '—'}</td><td className="px-5 py-4 text-sm text-slate-600">{item.area_m2 ? `${item.area_m2} m²` : '—'}</td><td className="px-5 py-4 text-sm text-slate-600">{item.rooms ?? '—'}</td></tr>)}</tbody>
              </table>
              {loading && <p className="px-5 py-6 text-sm text-slate-500">{lang === 'ru' ? 'Загрузка объявлений…' : 'E’lonlar yuklanmoqda…'}</p>}
              {!loading && listings.length === 0 && <p className="px-5 py-8 text-sm text-slate-500">{lang === 'ru' ? 'Объявления не найдены.' : 'E’lonlar topilmadi.'}</p>}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">{listings.map((item) => <a key={item.id} href={`/listings/${item.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"><div className="min-w-0"><p className="truncate font-bold">{title(item)}</p><p className="mt-1 text-sm text-slate-500">{location(item) || '—'}</p></div><p className="shrink-0 font-black text-emerald-600">{formatMoney(item.price, item.currency, lang)}</p></a>)}{loading && <p className="px-5 py-6 text-sm text-slate-500">{lang === 'ru' ? 'Загрузка объявлений…' : 'E’lonlar yuklanmoqda…'}</p>}</div>
          )}
        </div>
      )}
    </div>
  )
}
