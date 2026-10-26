'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatMoney } from '@/lib/money'

const views = [
  { key: 'list', icon: 'list' },
  { key: 'grid', icon: 'grid' },
  { key: 'table', icon: 'table' },
] as const

type ViewKey = (typeof views)[number]['key'] | 'map'
type MapListing = { id: string; title: string; price: number; currency: string; latitude: number | null; longitude: number | null }

declare global { interface Window { L?: any } }

function Icon({ type }: { type: (typeof views)[number]['icon'] }) {
  if (type === 'list') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" /><path d="M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeWidth="3" /></svg>
  if (type === 'grid') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16M15 4v16" /></svg>
}

function MapIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><path d="M12 21s7-6.1 7-12A7 7 0 1 0 5 9c0 5.9 7 12 7 12Z" /><circle cx="12" cy="9" r="2.2" /></svg> }

function HomeMap({ lang }: { lang: 'uz' | 'ru' }) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [items, setItems] = useState<MapListing[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const db = createClient()
      const { data } = await db.from('listing_search').select('id,title,price,currency,latitude,longitude').eq('status', 'active').order('published_at', { ascending: false }).limit(100)
      if (!cancelled) setItems((data || []) as MapListing[])
    }
    void load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let disposed = false
    const init = () => {
      if (disposed || !elRef.current || !window.L || mapRef.current) return
      const map = window.L.map(elRef.current, { scrollWheelZoom: true, zoomControl: false }).setView([41.2995, 69.2401], 7)
      window.L.control.zoom({ position: 'topleft' }).addTo(map)
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 80)
    }
    if (!document.getElementById('leaflet-css-home-view')) {
      const link = document.createElement('link'); link.id = 'leaflet-css-home-view'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link)
    }
    if (window.L) init()
    else {
      const existing = document.getElementById('leaflet-js-home-view') as HTMLScriptElement | null
      if (existing) existing.addEventListener('load', init)
      else { const script = document.createElement('script'); script.id = 'leaflet-js-home-view'; script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.async = true; script.onload = init; document.body.appendChild(script) }
    }
    return () => { disposed = true }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !window.L) return
    const map = mapRef.current
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    const points = items.filter((x) => x.latitude != null && x.longitude != null && Number.isFinite(Number(x.latitude)) && Number.isFinite(Number(x.longitude)))
    const key = (c: string) => { const v = String(c || '').trim().toUpperCase(); return ['UZS', 'SUM', 'SOM', "SO'M"].includes(v) ? 'UZS' : v === 'USD' || v === '$' ? 'USD' : v || 'OTHER' }
    const groups = new Map<string, number[]>()
    points.forEach((x) => { const k = key(x.currency); const a = groups.get(k) || []; a.push(Number(x.price)); groups.set(k, a) })
    const ranges = new Map<string, [number, number]>()
    groups.forEach((a, k) => { a.sort((x, y) => x - y); const at = (r: number) => a[Math.round((a.length - 1) * r)]; ranges.set(k, [at(1 / 3), at(2 / 3)]) })
    const color = (x: MapListing) => { const r = ranges.get(key(x.currency)); if (!r) return '#eab308'; const p = Number(x.price); return p <= r[0] ? '#22c55e' : p >= r[1] ? '#ef4444' : '#eab308' }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const price = (x: MapListing) => { if (key(x.currency) === 'UZS') { const m = Number(x.price) / 1000000; const f = new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { maximumFractionDigits: m < 1 ? 1 : m % 1 ? 1 : 0 }).format(m); return `${f} ${lang === 'ru' ? 'млн сум' : 'mln so‘m'}` } return formatMoney(Number(x.price), x.currency, lang) }

    points.forEach((x) => {
      const c = color(x); const p = price(x); const title = esc(String(x.title || '')); const detail = lang === 'ru' ? 'Подробнее →' : 'Batafsil →'
      const m = window.L.marker([Number(x.latitude), Number(x.longitude)], { icon: window.L.divIcon({ className: 'rh-price-marker', iconSize: [0, 0], iconAnchor: [0, 0], html: `<span data-dot style="position:absolute;left:-6px;top:-6px;width:12px;height:12px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.28)"></span><span data-price style="position:absolute;left:9px;top:-13px;opacity:0;transform:translateX(-4px);transition:opacity .35s,transform .35s;background:${c};color:#fff;border:2px solid #fff;border-radius:999px;padding:4px 8px;box-shadow:0 2px 9px rgba(0,0,0,.2);font-size:11px;font-weight:900;line-height:1;white-space:nowrap">${p}</span>` }) }).addTo(map)
      m.bindPopup(`<div style="min-width:190px"><b>${esc(p)}</b><br/><span>${title}</span><br/><a href="/listings/${encodeURIComponent(x.id)}" style="display:inline-block;margin-top:8px;color:#059669;font-weight:700">${detail}</a></div>`)
      markersRef.current.push(m)
    })

    const update = () => { const opacity = Math.max(0, Math.min(1, (map.getZoom() - 9.5) / 3.5)); markersRef.current.forEach((m) => { const e = m.getElement?.(); if (!e) return; const p = e.querySelector('[data-price]') as HTMLElement | null; const d = e.querySelector('[data-dot]') as HTMLElement | null; if (p) { p.style.opacity = String(opacity); p.style.transform = `translateX(${opacity ? '0' : '-4px'})` } if (d) d.style.transform = `scale(${0.95 + opacity * .15})` }) }
    map.on('zoom zoomend', update); setTimeout(update, 50)
    if (points.length > 1) map.fitBounds(window.L.latLngBounds(points.map((x) => [Number(x.latitude), Number(x.longitude)])), { padding: [30, 30], maxZoom: 12 })
    else if (points.length === 1) map.setView([Number(points[0].latitude), Number(points[0].longitude)], 14)
    else map.setView([41.2995, 69.2401], 7)
    setTimeout(() => map.invalidateSize(), 80)
    return () => map.off('zoom zoomend', update)
  }, [items, lang])

  const count = items.filter((x) => x.latitude != null && x.longitude != null).length
  return <div className="relative mt-5 h-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm sm:h-[620px]"><div ref={elRef} className="absolute inset-0" /><style>{`.rh-price-marker{background:transparent!important;border:0!important;}`}</style><div className="absolute bottom-4 left-4 z-[500] rounded-xl bg-white/95 px-4 py-3 shadow"><p className="text-xs font-semibold text-slate-500">{lang === 'ru' ? `${count} объявлений на карте` : `${count} ta e’lon xaritada`}</p></div></div>
}

export default function HomeViewSwitcher({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const [active, setActive] = useState<ViewKey>('grid')
  const selectView = (view: ViewKey) => {
    setActive(view)
    if (view === 'map') document.documentElement.dataset.royalhouseHomeView = 'map'; else delete document.documentElement.dataset.royalhouseHomeView
    window.dispatchEvent(new CustomEvent('royalhouse-home-view-change', { detail: { view } }))
    if (window.matchMedia('(max-width: 767px), (pointer: coarse)').matches) {
      const search = document.querySelector('[data-royalhouse-mobile-search]') as HTMLElement | null
      search?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const input = search?.querySelector('input[aria-label="Aqlli qidiruv"], input[aria-label="Умный поиск"]') as HTMLInputElement | null
      input?.focus({ preventScroll: true })
    }
  }
  const label = (key: ViewKey) => { if (key === 'list') return lang === 'ru' ? 'Список' : 'Ro‘yxat'; if (key === 'grid') return lang === 'ru' ? 'Сетка' : 'Znachki'; if (key === 'table') return lang === 'ru' ? 'Таблица' : 'Jadval'; return lang === 'ru' ? 'На карте' : 'Xaritada' }
  return <><style>{`html[data-royalhouse-home-view='map'] section:has(a[href^='/listings/']){display:none!important}`}</style><div className="mx-auto max-w-[1400px] px-4 pt-7 sm:pt-8"><div className="flex w-fit items-center rounded-2xl bg-[#ffd51a] p-1.5 shadow-sm sm:rounded-full"><div className="flex items-center gap-1">{views.map((view) => <button key={view.key} type="button" onClick={() => selectView(view.key)} aria-label={label(view.key)} title={label(view.key)} aria-pressed={active === view.key} className={`flex h-11 w-11 items-center justify-center rounded-xl text-slate-900/80 transition hover:bg-white/50 sm:h-10 sm:w-10 sm:rounded-full ${active === view.key ? 'bg-white/55' : ''}`}><Icon type={view.icon} /></button>)}</div><div className="ml-1 border-l border-slate-900/20 pl-1"><button type="button" onClick={() => selectView('map')} aria-label={label('map')} title={label('map')} aria-pressed={active === 'map'} className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-slate-900 transition hover:bg-white/50 sm:h-10 sm:rounded-full sm:px-4 ${active === 'map' ? 'bg-white/55' : ''}`}><MapIcon /><span>{label('map')}</span></button></div></div></div>{active === 'map' && <div className="mx-auto max-w-[1400px] px-4 pb-8"><HomeMap lang={lang} /></div>}</>
}
