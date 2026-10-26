'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatMoney } from '@/lib/money'

type ViewKey = 'list' | 'grid' | 'table' | 'map'
type MapListing = {
  id: string
  title: string
  price: number
  currency: string
  latitude: number | null
  longitude: number | null
}

const views = [
  { key: 'list', icon: 'list' },
  { key: 'grid', icon: 'grid' },
  { key: 'table', icon: 'table' },
] as const

function Icon({ type }: { type: (typeof views)[number]['icon'] }) {
  if (type === 'list') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
        <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeWidth="3" />
      </svg>
    )
  }

  if (type === 'grid') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16M15 4v16" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
      <path d="M12 21s7-6.1 7-12A7 7 0 1 0 5 9c0 5.9 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.2" />
    </svg>
  )
}

function HomeMap({ lang }: { lang: 'uz' | 'ru' }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [listings, setListings] = useState<MapListing[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const db = createClient()
      const { data } = await db
        .from('listing_search')
        .select('id,title,price,currency,latitude,longitude')
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .limit(100)
      if (!cancelled) setListings((data || []) as MapListing[])
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const init = () => {
      if (!ref.current || !window.L || mapRef.current) return
      const points = listings.filter(x => x.latitude != null && x.longitude != null)
      const center: [number, number] = points.length
        ? [Number(points[0].latitude), Number(points[0].longitude)]
        : [41.2995, 69.2401]
      const map = window.L.map(ref.current, { scrollWheelZoom: true }).setView(center, points.length ? 12 : 11)
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 100)
    }

    const cssId = 'leaflet-css-home-view'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    if (window.L) init()
    else {
      const existing = document.getElementById('leaflet-js-home-view') as HTMLScriptElement | null
      if (existing) existing.addEventListener('load', init)
      else {
        const script = document.createElement('script')
        script.id = 'leaflet-js-home-view'
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.async = true
        script.onload = init
        document.body.appendChild(script)
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [listings])

  useEffect(() => {
    if (!mapRef.current || !window.L) return
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []
    const points = listings.filter(x => x.latitude != null && x.longitude != null)

    points.forEach(item => {
      const marker = window.L.marker([Number(item.latitude), Number(item.longitude)]).addTo(mapRef.current)
      const title = String(item.title).replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const detailsLabel = lang === 'ru' ? 'Подробнее →' : 'Batafsil →'
      marker.bindPopup(
        `<div style="min-width:180px"><b>${formatMoney(item.price, item.currency, lang)}</b><br/><span>${title}</span><br/><a href="/listings/${item.id}" style="display:inline-block;margin-top:8px;color:#059669;font-weight:700">${detailsLabel}</a></div>`,
      )
      markersRef.current.push(marker)
    })

    if (points.length > 1) {
      mapRef.current.fitBounds(window.L.latLngBounds(points.map(x => [Number(x.latitude), Number(x.longitude)])).pad(0.12))
    } else if (points.length === 1) {
      mapRef.current.setView([Number(points[0].latitude), Number(points[0].longitude)], 15)
    }
    setTimeout(() => mapRef.current?.invalidateSize(), 100)
  }, [listings, lang])

  const count = listings.filter(x => x.latitude != null && x.longitude != null).length
  return (
    <div className="relative mt-5 h-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm sm:h-[620px]">
      <div ref={ref} className="absolute inset-0" />
      {count === 0 && (
        <div className="absolute left-4 right-4 top-4 z-[500] rounded-xl bg-white/95 px-4 py-3 text-sm font-semibold text-slate-600 shadow">
          {lang === 'ru' ? 'Для активных объявлений нет координат для карты.' : 'Faol e’lonlarda xarita koordinatasi mavjud emas.'}
        </div>
      )}
      <div className="absolute bottom-4 left-4 z-[500] rounded-xl bg-white/95 px-4 py-3 shadow">
        <p className="text-xs font-semibold text-slate-500">{count} ta e’lon xaritada</p>
      </div>
    </div>
  )
}

declare global { interface Window { L?: any } }

export default function HomeViewSwitcher({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const [active, setActive] = useState<ViewKey>('grid')

  useEffect(() => {
    document.documentElement.dataset.royalhouseHomeView = active
    return () => { delete document.documentElement.dataset.royalhouseHomeView }
  }, [active])

  const selectView = (view: ViewKey) => {
    setActive(view)
    document.documentElement.dataset.royalhouseHomeView = view
    window.dispatchEvent(new CustomEvent('royalhouse-home-view-change', { detail: { view } }))
  }

  const label = (key: ViewKey) => {
    if (key === 'list') return lang === 'ru' ? 'Список' : 'Ro‘yxat'
    if (key === 'grid') return lang === 'ru' ? 'Сетка' : 'Znachki'
    if (key === 'table') return lang === 'ru' ? 'Таблица' : 'Jadval'
    return lang === 'ru' ? 'В карте' : 'Xaritada'
  }

  return (
    <>
      <style>{`
        /* Home view modes stay on the home page. No /listings navigation and no detailed filter. */
        html[data-royalhouse-home-view='list'] a[href^='/listings/'] {
          display: grid !important;
          grid-template-columns: 150px minmax(0, 1fr) !important;
          min-height: 150px !important;
        }
        html[data-royalhouse-home-view='list'] a[href^='/listings/'] > div:first-child {
          aspect-ratio: auto !important;
          height: 100% !important;
        }
        html[data-royalhouse-home-view='table'] a[href^='/listings/'] {
          display: grid !important;
          grid-template-columns: 96px minmax(0, 1fr) !important;
          min-height: 108px !important;
          border-radius: 0 !important;
          border-width: 0 0 1px 0 !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:first-child {
          aspect-ratio: auto !important;
          height: 100% !important;
        }
        html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:last-child {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 18px !important;
        }
        html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:last-child > * {
          min-width: 0 !important;
        }
        html[data-royalhouse-home-view='map'] .rh-home-view-switcher ~ section {
          display: none !important;
        }
        @media (max-width: 767px), (pointer: coarse) {
          html[data-royalhouse-home-view='list'] a[href^='/listings/'],
          html[data-royalhouse-home-view='table'] a[href^='/listings/'] {
            grid-template-columns: 108px minmax(0, 1fr) !important;
          }
        }
      `}</style>
      <div className="rh-home-view-switcher mx-auto max-w-[1400px] px-4 pt-7 sm:pt-8">
        <div className="flex w-fit items-center rounded-2xl bg-[#ffd51a] p-1.5 shadow-sm sm:rounded-full">
          <div className="flex items-center gap-1">
            {views.map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => selectView(view.key)}
                aria-label={label(view.key)}
                title={label(view.key)}
                aria-pressed={active === view.key}
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-slate-900/80 transition hover:bg-white/50 sm:h-10 sm:w-10 sm:rounded-full ${active === view.key ? 'bg-white/55' : ''}`}
              >
                <Icon type={view.icon} />
              </button>
            ))}
          </div>
          <div className="ml-1 border-l border-slate-900/20 pl-1">
            <button
              type="button"
              onClick={() => selectView('map')}
              aria-label={label('map')}
              title={label('map')}
              aria-pressed={active === 'map'}
              className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-slate-900 transition hover:bg-white/50 sm:h-10 sm:rounded-full sm:px-4 ${active === 'map' ? 'bg-white/55' : ''}`}
            >
              <MapIcon />
              <span>{label('map')}</span>
            </button>
          </div>
        </div>
        {active === 'map' && <HomeMap lang={lang} />}
      </div>
    </>
  )
}
