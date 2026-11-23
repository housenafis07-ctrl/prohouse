'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from './I18nProvider'

if (typeof document !== 'undefined' && !document.getElementById('prohouse-listing-view-controls')) {
  const style = document.createElement('style')
  style.id = 'prohouse-listing-view-controls'
  style.textContent = `
    @keyframes prohouse-map-marker-reveal {
      from { opacity: .35; transform: scale(.86); }
      to { opacity: 1; transform: scale(1); }
    }
    .prohouse-map-marker-reveal { animation: prohouse-map-marker-reveal .18s ease-out; }
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
  getZoom: () => number
  on: (event: string, handler: () => void) => LeafletMap
  off: (event: string, handler: () => void) => LeafletMap
  remove: () => void
}

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker
  bindPopup: (content: string, options?: Record<string, unknown>) => LeafletMarker
  setIcon: (icon: unknown) => LeafletMarker
  remove?: () => void
}

const TASHKENT: [number, number] = [41.2995, 69.2401]
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const USD_TO_UZS_FOR_MAP = 12500

type Lang = 'uz' | 'ru'
type PriceBand = 'low' | 'mid' | 'high'

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

function mapComparablePrice(item: MapListing) {
  const value = Number(item.price)
  if (!Number.isFinite(value)) return null
  return item.currency === 'USD' ? value * USD_TO_UZS_FOR_MAP : value
}

function getPriceBands(rows: MapListing[]) {
  const values = rows
    .map((item) => mapComparablePrice(item))
    .filter((value): value is number => value !== null && value > 0)
    .sort((a, b) => a - b)

  if (values.length < 3) {
    return new Map(rows.map((item) => [item.id, 'mid' as PriceBand]))
  }

  const lowCut = values[Math.max(0, Math.floor((values.length - 1) * 0.33))]
  const highCut = values[Math.max(0, Math.floor((values.length - 1) * 0.66))]
  const bands = new Map<string, PriceBand>()

  rows.forEach((item) => {
    const value = mapComparablePrice(item)
    if (value === null) bands.set(item.id, 'mid')
    else if (value <= lowCut) bands.set(item.id, 'low')
    else if (value >= highCut) bands.set(item.id, 'high')
    else bands.set(item.id, 'mid')
  })

  return bands
}

function priceBandColor(band: PriceBand) {
  if (band === 'low') return { background: '#16a34a', border: '#15803d' }
  if (band === 'high') return { background: '#dc2626', border: '#b91c1c' }
  return { background: '#eab308', border: '#ca8a04' }
}

function markerIcon(item: MapListing, band: PriceBand, lang: Lang, zoom: number) {
  const colors = priceBandColor(band)
  const showPrice = zoom >= 13
  const fullPrice = zoom >= 14
  const price = escapeHtml(formatMoney(item.price, item.currency, lang))

  if (!showPrice) {
    return window.L.divIcon({
      className: 'prohouse-map-marker-reveal',
      html: `<span aria-label="${price}" style="display:block;width:${zoom <= 9 ? 14 : 18}px;height:${zoom <= 9 ? 14 : 18}px;background:${colors.background};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.22)"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })
  }

  return window.L.divIcon({
    className: 'prohouse-map-marker-reveal',
    html: `<span style="display:inline-flex;align-items:center;justify-content:center;background:${colors.background};border:2px solid ${colors.border};color:#fff;border-radius:999px;padding:${fullPrice ? '5px 9px' : '4px 7px'};box-shadow:0 3px 12px rgba(0,0,0,.18);font-size:${fullPrice ? 11 : 10}px;font-weight:900;line-height:1;white-space:nowrap">${price}</span>`,
    iconAnchor: [0, 10],
  })
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
  return value.replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char] || char))
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
  const zoomHandlerRef = useRef<(() => void) | null>(null)
  const markerLayerRef = useRef<LeafletMarker[]>([])
  const markerItemsRef = useRef<MapListing[]>([])
  const markerBandsRef = useRef<Map<string, PriceBand>>(new Map())
  const [listings, setListings] = useState<MapListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [apiReady, setApiReady] = useState(false)
  const { lang } = useI18n()

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
      if (zoomHandlerRef.current) map.off('zoomend', zoomHandlerRef.current)
      map.remove()
      mapRef.current = null
    }
  }, [apiReady])

  useEffect(() => {
    if (!apiReady || !mapRef.current || !window.L) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const updateMarkerIcons = () => {
      const map = mapRef.current
      if (!map || cancelled) return
      const zoom = map.getZoom()
      markerLayerRef.current.forEach((marker, index) => {
        const item = markerItemsRef.current[index]
        if (!item) return
        const band = markerBandsRef.current.get(item.id) || 'mid'
        marker.setIcon(markerIcon(item, band, lang, zoom))
      })
    }

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
        markerItemsRef.current = rows
        markerBandsRef.current = getPriceBands(rows)

        markerLayerRef.current.forEach((marker) => marker.remove?.())
        markerLayerRef.current = []

        const map = mapRef.current
        const leaflet = window.L
        const zoom = map.getZoom()
        const markers = rows.map((item) => {
          const band = markerBandsRef.current.get(item.id) || 'mid'
          const marker = leaflet.marker([item.latitude, item.longitude], {
            icon: markerIcon(item, band, lang, zoom),
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
    const zoomHandler = updateMarkerIcons
    boundsHandlerRef.current = handler
    zoomHandlerRef.current = zoomHandler
    mapRef.current.on('moveend', handler)
    mapRef.current.on('zoomend', zoomHandler)
    void loadMarkers(mapRef.current.getBounds())

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      mapRef.current?.off('moveend', handler)
      mapRef.current?.off('zoomend', zoomHandler)
      boundsHandlerRef.current = null
      zoomHandlerRef.current = null
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
