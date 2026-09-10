'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

if (typeof document !== 'undefined' && !document.getElementById('prohouse-listing-view-controls')) {
  const style = document.createElement('style')
  style.id = 'prohouse-listing-view-controls'
  style.textContent = `
    button[title="Jadval"], button[title="Ro‘yxat"], button[title="Znachki"],
    button[title="Таблица"], button[title="Список"], button[title="Карточки"] {
      font-size: 0 !important;
      width: 44px;
      min-width: 44px;
      padding-left: 0 !important;
      padding-right: 0 !important;
      justify-content: center;
    }
    button[title="Jadval"]::before, button[title="Таблица"]::before { content: '▦'; font-size: 20px; line-height: 1; }
    button[title="Ro‘yxat"]::before, button[title="Список"]::before { content: '☰'; font-size: 19px; line-height: 1; }
    button[title="Znachki"]::before, button[title="Карточки"]::before { content: '▥'; font-size: 20px; line-height: 1; }
  `
  document.head.appendChild(style)
}

type MapListing = {
  id: string
  title: string
  title_ru?: string | null
  price: number
  currency: string
  listing_type: string
  property_type: string | null
  city: string
  district: string | null
  latitude: number
  longitude: number
  is_trusted_seller: boolean
}

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap
  getBounds: () => { getSouth: () => number; getNorth: () => number; getWest: () => number; getEast: () => number }
  on: (event: string, handler: () => void) => LeafletMap
  off: (event: string, handler: () => void) => LeafletMap
  remove: () => void
}

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker
  bindPopup: (content: string, options?: Record<string, unknown>) => LeafletMarker
  remove?: () => void
}

const TASHKENT: [number, number] = [41.2995, 69.2401]
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'

type Lang = 'uz' | 'ru'

function formatMoney(value: number, currency: string, lang: Lang) {
  if (currency === 'USD') {
    return `${new Intl.NumberFormat('ru-RU').format(Number(value))} $`
  }

  const millions = Number(value) / 1_000_000
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: millions % 1 === 0 ? 0 : 1,
  }).format(millions)
  return lang === 'ru' ? `${formatted} млн сум` : `${formatted} mln so‘m`
}

function listingQuery(searchParams: string, bounds?: { getSouth: () => number; getNorth: () => number; getWest: () => number; getEast: () => number }) {
  const params = new URLSearchParams(searchParams)
  params.delete('view')
  params.delete('cursor')
  params.delete('page')
  params.delete('limit')
  params.set('limit', '500')
  if (bounds) {
    params.set('south', String(bounds.getSouth()))
    params.set('north', String(bounds.getNorth()))
    params.set('west', String(bounds.getWest()))
    params.set('east', String(bounds.getEast()))
  }
  return params.toString()
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}

function popupHtml(item: MapListing, lang: Lang) {
  const title = escapeHtml(lang === 'ru' && item.title_ru ? item.title_ru : item.title)
  const location = escapeHtml(`${item.city}${item.district ? `, ${item.district}` : ''}`)
  const trusted = item.is_trusted_seller
    ? `<div style="display:inline-flex;align-items:center;gap:5px;margin-top:7px;border-radius:999px;background:#ecfdf5;color:#047857;padding:4px 8px;font-size:11px;font-weight:800">✓ ${lang === 'ru' ? 'Надёжный профиль' : 'Ishonchli profil'}</div>`
    : ''
  return `<div style="min-width:210px"><div style="font-weight:800;font-size:15px;line-height:1.25">${title}</div><div style="margin-top:6px;font-weight:900;font-size:16px">${formatMoney(item.price, item.currency, lang)}</div><div style="margin-top:4px;color:#64748b;font-size:12px">⌖ ${location}</div>${trusted}<a href="/listings/${encodeURIComponent(item.id)}" style="display:inline-flex;margin-top:10px;border-radius:9px;background:#059669;color:#fff;padding:7px 10px;text-decoration:none;font-weight:800;font-size:12px">${lang === 'ru' ? 'Открыть объявление →' : 'E’lonni ko‘rish →'}</a></div>`
}

export default function ListingsMap({ searchParams }: { searchParams: string }) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const boundsHandlerRef = useRef<(() => void) | null>(null)
  const markerLayerRef = useRef<LeafletMarker[]>([])
  const [listings, setListings] = useState<MapListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [apiReady, setApiReady] = useState(false)
  const lang: Lang = typeof window !== 'undefined' && localStorage.getItem('prohouse-lang') === 'ru' ? 'ru' : 'uz'

  useEffect(() => {
    if (window.L) {
      setApiReady(true)
      return
    }

    const existing = document.querySelector('script[data-prohouse-leaflet]') as HTMLScriptElement | null
    const script = existing || document.createElement('script')
    const handleLoad = () => setApiReady(Boolean(window.L))
    script.src = LEAFLET_JS
    script.async = true
    script.dataset.prohouseLeaflet = 'true'
    script.addEventListener('load', handleLoad)
    if (!existing) document.body.appendChild(script)

    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }

    return () => script.removeEventListener('load', handleLoad)
  }, [])

  useEffect(() => {
    if (!apiReady || !containerRef.current || !window.L) return
    const map = window.L.map(containerRef.current).setView(TASHKENT, 11)
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map

    return () => {
      if (boundsHandlerRef.current) map.off('moveend', boundsHandlerRef.current)
      map.remove()
      mapRef.current = null
    }
  }, [apiReady])

  useEffect(() => {
    if (!apiReady || !mapRef.current || !window.L) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const loadMarkers = async (bounds: ReturnType<LeafletMap['getBounds']>) => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/listings/map?${listingQuery(searchParams, bounds)}`, { cache: 'no-store' })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || (lang === 'ru' ? 'Не удалось загрузить объявления на карте.' : 'Xaritadagi e’lonlarni yuklab bo‘lmadi.'))
        if (cancelled || !window.L || !mapRef.current) return

        const rows = (result.data || []) as MapListing[]
        setListings(rows)

        markerLayerRef.current.forEach((marker) => marker.remove?.())
        markerLayerRef.current = []

        const map = mapRef.current
        const leaflet = window.L
        const markers = rows.map((item) => {
          const marker = leaflet.marker([item.latitude, item.longitude], {
            icon: leaflet.divIcon({
              className: 'prohouse-price-marker',
              html: `<span style="display:inline-block;background:${item.is_trusted_seller ? '#059669' : '#ffd51a'};color:${item.is_trusted_seller ? '#fff' : '#111827'};border:2px solid #fff;border-radius:999px;padding:6px 9px;box-shadow:0 3px 12px rgba(0,0,0,.18);font-size:11px;font-weight:900;white-space:nowrap">${formatMoney(item.price, item.currency, lang)}</span>`,
              iconAnchor: [0, 16],
            }),
          }).addTo(map)
          marker.bindPopup(popupHtml(item, lang), { maxWidth: 280 })
          return marker
        })
        markerLayerRef.current = markers
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : (lang === 'ru' ? 'Карта не загрузилась.' : 'Xarita yuklanmadi.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const scheduleBoundsLoad = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const map = mapRef.current
        if (map) void loadMarkers(map.getBounds())
      }, 350)
    }

    const handler = scheduleBoundsLoad
    boundsHandlerRef.current = handler
    mapRef.current.on('moveend', handler)
    void loadMarkers(mapRef.current.getBounds())

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      mapRef.current?.off('moveend', handler)
      boundsHandlerRef.current = null
    }
  }, [apiReady, searchParams, lang])

  if (error && !apiReady) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-3xl border bg-white p-8 text-center">
        <div className="max-w-md">
          <div className="text-4xl">⌖</div>
          <h2 className="mt-3 text-lg font-black">{lang === 'ru' ? 'Карта не загрузилась' : 'Xarita yuklanmadi'}</h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div ref={containerRef} className="h-[62vh] min-h-[520px] w-full md:h-[680px]" />
      <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
        <div className="rounded-full bg-white/95 px-4 py-2 text-xs font-black shadow-lg backdrop-blur">
          {loading ? (lang === 'ru' ? 'Загрузка…' : 'Yuklanmoqda…') : `${listings.length}${listings.length >= 500 ? '+' : ''} ${lang === 'ru' ? 'объявлений на карте' : 'ta e’lon xaritada'}`}
        </div>
        <button onClick={() => router.push(`/listings?${searchParams}`)} className="rounded-full bg-white/95 px-4 py-2 text-xs font-black shadow-lg backdrop-blur">
          {lang === 'ru' ? 'Вернуться к списку' : 'Ro‘yxatga qaytish'}
        </button>
      </div>
      {error && apiReady && <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-lg">{error}</div>}
    </div>
  )
}
