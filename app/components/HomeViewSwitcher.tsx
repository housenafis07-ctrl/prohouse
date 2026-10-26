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
  if (type === 'list') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" /><path d="M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeWidth="3" /></svg>
  if (type === 'grid') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16M15 4v16" /></svg>
}

function MapIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><path d="M12 21s7-6.1 7-12A7 7 0 1 0 5 9c0 5.9 7 12 7 12Z" /><circle cx="12" cy="9" r="2.2" /></svg>
}

declare global { interface Window { L?: any } }

function HomeMap({ lang }: { lang: 'uz' | 'ru' }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [listings, setListings] = useState<MapListing[]>([])
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const db = createClient()
      const { data } = await db.from('listing_search').select('id,title,price,currency,latitude,longitude').eq('status', 'active').order('published_at', { ascending: false }).limit(100)
      if (!cancelled) setListings((data || []) as MapListing[])
    })()
    return () => { cancelled = true }
  }, [])

  // Create Leaflet exactly once. Listing refreshes only update markers.
  useEffect(() => {
    const init = () => {
      if (!ref.current || !window.L || mapRef.current) return
      const map = window.L.map(ref.current, { scrollWheelZoom: true, zoomControl: false }).setView([41.2995, 69.2401], 7)
      window.L.control.zoom({ position: 'topleft' }).addTo(map)
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
      mapRef.current = map
      setMapReady(true)
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
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.L) return

    const map = mapRef.current
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    const points = listings.filter(item =>
      item.latitude != null &&
      item.longitude != null &&
      Number.isFinite(Number(item.latitude)) &&
      Number.isFinite(Number(item.longitude))
    )

    const currencyKey = (currency: string) => {
      const value = String(currency || '').trim().toUpperCase()
      if (value === 'UZS' || value === 'SUM' || value === 'SOM' || value === "SO'M") return 'UZS'
      if (value === 'USD' || value === '$') return 'USD'
      return value || 'OTHER'
    }

    const grouped = new Map<string, number[]>()
    points.forEach(item => {
      const key = currencyKey(item.currency)
      const value = Number(item.price)
      if (!Number.isFinite(value)) return
      const values = grouped.get(key) || []
      values.push(value)
      grouped.set(key, values)
    })

    const thresholds = new Map<string, { low: number; high: number }>()
    grouped.forEach((values, key) => {
      values.sort((a, b) => a - b)
      const at = (ratio: number) => values[Math.max(0, Math.min(values.length - 1, Math.round((values.length - 1) * ratio)))]
      thresholds.set(key, { low: at(1 / 3), high: at(2 / 3) })
    })

    const markerColor = (item: MapListing) => {
      const threshold = thresholds.get(currencyKey(item.currency))
      if (!threshold) return '#eab308'
      const value = Number(item.price)
      if (value <= threshold.low) return '#22c55e'
      if (value >= threshold.high) return '#ef4444'
      return '#eab308'
    }

    const escapeHtml = (value: string) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    const formatMapPrice = (item: MapListing) => {
      const normalized = currencyKey(item.currency)
      if (normalized === 'UZS') {
        const millions = Number(item.price) / 1_000_000
        const maximumFractionDigits = millions < 1 ? 1 : millions % 1 === 0 ? 0 : 1
        const formatted = new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { maximumFractionDigits }).format(millions)
        return `${formatted} ${lang === 'ru' ? 'млн сум' : 'mln so‘m'}`
      }
      return formatMoney(Number(item.price), item.currency, lang)
    }

    points.forEach(item => {
      const color = markerColor(item)
      const priceLabel = formatMapPrice(item)
      const title = escapeHtml(String(item.title || ''))
      const detailsLabel = lang === 'ru' ? 'Подробнее →' : 'Batafsil →'

      const marker = window.L.marker([Number(item.latitude), Number(item.longitude)], {
        icon: window.L.divIcon({
          className: 'royalhouse-home-map-marker',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          html: `<span data-rh-dot="true" style="position:absolute;left:-6px;top:-6px;width:12px;height:12px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.28);transition:transform .25s ease"></span><span data-rh-price="true" style="position:absolute;left:9px;top:-13px;opacity:0;transform:translateX(-4px) scale(.96);transition:opacity .35s ease,transform .35s ease;background:${color};color:#fff;border:2px solid #fff;border-radius:999px;padding:4px 8px;box-shadow:0 2px 9px rgba(0,0,0,.2);font-size:11px;font-weight:900;line-height:1;white-space:nowrap">${priceLabel}</span>`,
        }),
      }).addTo(map)

      marker.bindPopup(`<div style="min-width:180px"><b>${escapeHtml(priceLabel)}</b><br/><span>${title}</span><br/><a href="/listings/${encodeURIComponent(item.id)}" style="display:inline-block;margin-top:8px;color:#059669;font-weight:700">${detailsLabel}</a></div>`)
      markersRef.current.push(marker)
    })

    const updateLabelVisibility = () => {
      const opacity = Math.max(0, Math.min(1, (map.getZoom() - 9.5) / 3.5))
      markersRef.current.forEach(marker => {
        const element = marker.getElement?.()
        if (!element) return
        const price = element.querySelector('[data-rh-price]') as HTMLElement | null
        const dot = element.querySelector('[data-rh-dot]') as HTMLElement | null
        if (price) {
          price.style.opacity = String(opacity)
          price.style.transform = `translateX(${opacity > 0 ? '0' : '-4px'}) scale(${0.96 + opacity * 0.04})`
          price.style.pointerEvents = opacity > 0.25 ? 'auto' : 'none'
        }
        if (dot) dot.style.transform = `scale(${0.95 + opacity * 0.15})`
      })
    }

    map.on('zoom zoomend', updateLabelVisibility)
    setTimeout(updateLabelVisibility, 50)

    if (points.length === 1) {
      map.setView([Number(points[0].latitude), Number(points[0].longitude)], 14)
    } else {
      const currentZoom = map.getZoom()
      if (currentZoom < 6 || currentZoom > 12) map.setView([41.2995, 69.2401], 7)
    }

    setTimeout(() => map.invalidateSize(), 100)
    return () => map.off('zoom zoomend', updateLabelVisibility)
  }, [listings, lang, mapReady])

  const count = listings.filter(item => item.latitude != null && item.longitude != null).length
  return <div className="relative mt-5 h-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm sm:h-[620px]"><div ref={ref} className="absolute inset-0" /><style>{`.royalhouse-home-map-marker{background:transparent!important;border:0!important;}`}</style>{count === 0 && <div className="absolute left-4 right-4 top-4 z-[500] rounded-xl bg-white/95 px-4 py-3 text-sm font-semibold text-slate-600 shadow">{lang === 'ru' ? 'Для активных объявлений нет координат для карты.' : 'Faol e’lonlarda xarita koordinatasi mavjud emas.'}</div>}<div className="absolute bottom-4 left-4 z-[500] rounded-xl bg-white/95 px-4 py-3 shadow"><p className="text-xs font-semibold text-slate-500">{lang === 'ru' ? `${count} объявлений на карте` : `${count} ta e’lon xaritada`}</p></div></div>
}

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
    return lang === 'ru' ? 'На карте' : 'Xaritada'
  }

  return <>
    <style>{`
      html[data-royalhouse-home-view='list'] section:has(a[href^='/listings/']) > div:has(> a[href^='/listings/']) { grid-template-columns: minmax(0, 1fr) !important; }
      html[data-royalhouse-home-view='list'] a[href^='/listings/'] { display: grid !important; grid-template-columns: 150px minmax(0, 1fr) !important; min-height: 150px !important; }
      html[data-royalhouse-home-view='list'] a[href^='/listings/'] > div:first-child { aspect-ratio: auto !important; height: 100% !important; }

      html[data-royalhouse-home-view='table'] section:has(a[href^='/listings/']) > div:has(> a[href^='/listings/']) { display: block !important; overflow: hidden !important; border: 1px solid rgb(226 232 240) !important; border-radius: 1rem !important; background: white !important; }
      html[data-royalhouse-home-view='table'] a[href^='/listings/'] { display: grid !important; grid-template-columns: 112px minmax(220px, 2fr) minmax(180px, 1.25fr) minmax(150px, 1fr) !important; grid-template-rows: minmax(52px, auto) minmax(38px, auto) !important; align-items: center !important; min-height: 118px !important; border-radius: 0 !important; border: 0 !important; border-bottom: 1px solid rgb(226 232 240) !important; box-shadow: none !important; transform: none !important; }
      html[data-royalhouse-home-view='table'] a[href^='/listings/']:last-child { border-bottom: 0 !important; }
      html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:first-child { grid-column: 1 !important; grid-row: 1 / 3 !important; align-self: stretch !important; aspect-ratio: auto !important; height: auto !important; min-height: 118px !important; border-radius: 0 !important; }
      html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:last-child { display: contents !important; }
      html[data-royalhouse-home-view='table'] a[href^='/listings/'] h3 { grid-column: 4 !important; grid-row: 1 / 3 !important; margin: 0 !important; padding: 0 18px !important; font-size: 16px !important; }
      html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:last-child > p { grid-column: 2 !important; grid-row: 1 !important; margin: 0 !important; padding: 0 12px !important; font-size: 14px !important; }
      html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:last-child > div:nth-of-type(1) { grid-column: 3 !important; grid-row: 1 !important; margin: 0 !important; padding: 0 12px !important; }
      html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:last-child > div:nth-of-type(2) { grid-column: 3 !important; grid-row: 2 !important; margin: 0 !important; padding: 0 12px !important; }
      html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:last-child > div:nth-of-type(3) { display: none !important; }
      html[data-royalhouse-home-view='table'] a[href^='/listings/']::before { content: 'Rasm'; position: absolute; top: -42px; left: 0; width: 112px; padding: 12px; font-size: 11px; font-weight: 800; color: rgb(100 116 139); }
      html[data-royalhouse-home-view='table'] section:has(a[href^='/listings/']) { padding-top: 52px !important; }
      html[data-royalhouse-home-view='table'] section:has(a[href^='/listings/'])::before { content: 'E’lon                                      Manzil                                  Narx'; display: block; position: absolute; z-index: 2; height: 42px; margin-top: -52px; left: 0; right: 0; padding: 13px 18px 11px 124px; background: rgb(248 250 252); border: 1px solid rgb(226 232 240); border-bottom: 0; border-radius: 1rem 1rem 0 0; white-space: pre; font-size: 11px; font-weight: 800; color: rgb(100 116 139); }

      html[data-royalhouse-home-view='map'] section:has(a[href^='/listings/']) { display: none !important; }
      @media (max-width: 767px), (pointer: coarse) {
        html[data-royalhouse-home-view='list'] a[href^='/listings/'], html[data-royalhouse-home-view='table'] a[href^='/listings/'] { grid-template-columns: 108px minmax(0, 1fr) !important; }
        html[data-royalhouse-home-view='table'] a[href^='/listings/'] { grid-template-rows: auto auto auto !important; min-height: 128px !important; }
        html[data-royalhouse-home-view='table'] a[href^='/listings/'] h3 { grid-column: 2 !important; grid-row: 1 !important; padding: 10px 14px 0 !important; }
        html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:last-child > p { grid-column: 2 !important; grid-row: 2 !important; padding: 0 14px !important; }
        html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:last-child > div:nth-of-type(1) { grid-column: 2 !important; grid-row: 3 !important; padding: 0 14px 10px !important; }
        html[data-royalhouse-home-view='table'] a[href^='/listings/'] > div:last-child > div:nth-of-type(2) { display: none !important; }
        html[data-royalhouse-home-view='table'] section:has(a[href^='/listings/'])::before { content: 'E’lon / Narx / Manzil'; padding-left: 122px; white-space: nowrap; }
        html[data-royalhouse-home-view='table'] a[href^='/listings/']::before { display: none !important; }
      }
    `}</style>
    <div className="rh-home-view-switcher mx-auto max-w-[1400px] px-4 pt-7 sm:pt-8">
      <div className="flex w-fit items-center rounded-2xl bg-[#ffd51a] p-1.5 shadow-sm sm:rounded-full">
        <div className="flex items-center gap-1">
          {views.map((view) => <button key={view.key} type="button" onClick={() => selectView(view.key)} aria-label={label(view.key)} title={label(view.key)} aria-pressed={active === view.key} className={`flex h-11 w-11 items-center justify-center rounded-xl text-slate-900/80 transition hover:bg-white/50 sm:h-10 sm:w-10 sm:rounded-full ${active === view.key ? 'bg-white/55' : ''}`}><Icon type={view.icon} /></button>)}
        </div>
        <div className="ml-1 border-l border-slate-900/20 pl-1">
          <button type="button" onClick={() => selectView('map')} aria-label={label('map')} title={label('map')} aria-pressed={active === 'map'} className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-slate-900 transition hover:bg-white/50 sm:h-10 sm:rounded-full sm:px-4 ${active === 'map' ? 'bg-white/55' : ''}`}><MapIcon /><span>{label('map')}</span></button>
        </div>
      </div>
      {active === 'map' && <HomeMap lang={lang} />}
    </div>
  </>
}
