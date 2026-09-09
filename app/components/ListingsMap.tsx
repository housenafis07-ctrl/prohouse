'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type MapListing = {
  id: string
  title: string
  price: number
  currency: string
  listing_type: string
  property_type: string | null
  city: string
  district: string | null
  latitude: number
  longitude: number
}

type YMaps = {
  Map: new (element: HTMLElement, options: { center: [number, number]; zoom: number; controls?: string[] }) => YMapInstance
  Placemark: new (geometry: [number, number], properties?: Record<string, unknown>, options?: Record<string, unknown>) => unknown
  Clusterer: new (options?: Record<string, unknown>) => YClusterer
  templateLayoutFactory: { createClass: (template: string) => unknown }
}

type YMapInstance = {
  geoObjects: { add: (object: unknown) => void; remove: (object: unknown) => void; removeAll: () => void }
  getBounds: () => [[number, number], [number, number]] | null
  events: { add: (event: string, handler: () => void) => void; remove: (event: string, handler: () => void) => void }
  destroy: () => void
}

type YClusterer = {
  add: (objects: unknown[]) => void
  removeAll: () => void
}

declare global {
  interface Window {
    ymaps?: YMaps & { ready: (callback: () => void) => void }
  }
}

const TASHKENT: [number, number] = [41.2995, 69.2401]

function formatMoney(value: number, currency: string) {
  return `${new Intl.NumberFormat('ru-RU').format(Number(value))} ${currency === 'USD' ? '$' : 'so‘m'}`
}

function listingQuery(searchParams: string, bounds?: [[number, number], [number, number]]) {
  const params = new URLSearchParams(searchParams)
  params.delete('view')
  params.delete('cursor')
  params.delete('page')
  params.set('limit', '501')
  if (bounds) {
    const [[south, west], [north, east]] = bounds
    params.set('south', String(Math.min(south, north)))
    params.set('north', String(Math.max(south, north)))
    params.set('west', String(Math.min(west, east)))
    params.set('east', String(Math.max(west, east)))
  }
  return params.toString()
}

export default function ListingsMap({ searchParams }: { searchParams: string }) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<YMapInstance | null>(null)
  const clustererRef = useRef<YClusterer | null>(null)
  const boundsHandlerRef = useRef<(() => void) | null>(null)
  const [listings, setListings] = useState<MapListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [apiReady, setApiReady] = useState(false)

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY
    if (!key) {
      setError('Xarita uchun Yandex Maps API kaliti sozlanmagan.')
      setLoading(false)
      return
    }

    if (window.ymaps) {
      window.ymaps.ready(() => setApiReady(true))
      return
    }

    const existing = document.querySelector('script[data-prohouse-yandex-maps]') as HTMLScriptElement | null
    const script = existing || document.createElement('script')
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=uz_UZ`
    script.async = true
    script.dataset.prohouseYandexMaps = 'true'
    if (!existing) document.head.appendChild(script)
    script.addEventListener('load', () => window.ymaps?.ready(() => setApiReady(true)), { once: true })
    return () => script.removeEventListener('load', () => window.ymaps?.ready(() => setApiReady(true)))
  }, [])

  useEffect(() => {
    if (!apiReady || !containerRef.current || !window.ymaps) return
    const ymaps = window.ymaps
    const map = new ymaps.Map(containerRef.current, { center: TASHKENT, zoom: 11, controls: ['zoomControl'] })
    const clusterer = new ymaps.Clusterer({
      preset: 'islands#invertedVioletClusterIcons',
      groupByCoordinates: false,
      clusterDisableClickZoom: false,
    })
    map.geoObjects.add(clusterer)
    mapRef.current = map
    clustererRef.current = clusterer

    return () => {
      if (boundsHandlerRef.current) map.events.remove('boundschange', boundsHandlerRef.current)
      map.destroy()
      mapRef.current = null
      clustererRef.current = null
    }
  }, [apiReady])

  useEffect(() => {
    if (!apiReady || !mapRef.current || !clustererRef.current || !window.ymaps) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const loadMarkers = async (bounds?: [[number, number], [number, number]]) => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/listings/map?${listingQuery(searchParams, bounds)}`, { cache: 'no-store' })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Xaritadagi e’lonlarni yuklab bo‘lmadi.')
        if (cancelled) return
        const rows = (result.data || []) as MapListing[]
        setListings(rows)

        const ymaps = window.ymaps!
        const objects = rows.map((item) => new ymaps.Placemark(
          [item.latitude, item.longitude],
          {
            balloonContentHeader: item.title,
            balloonContentBody: `${formatMoney(item.price, item.currency)}<br/>${item.city}${item.district ? `, ${item.district}` : ''}`,
            hintContent: formatMoney(item.price, item.currency),
          },
          { preset: 'islands#yellowStretchyIcon', openBalloonOnClick: true },
        ))
        clustererRef.current?.removeAll()
        clustererRef.current?.add(objects)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Xarita yuklanmadi.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const scheduleBoundsLoad = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const bounds = mapRef.current?.getBounds() || undefined
        void loadMarkers(bounds)
      }, 350)
    }

    void loadMarkers()
    const handler = scheduleBoundsLoad
    boundsHandlerRef.current = handler
    mapRef.current.events.add('boundschange', handler)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      mapRef.current?.events.remove('boundschange', handler)
      boundsHandlerRef.current = null
    }
  }, [apiReady, searchParams])

  if (error && !apiReady) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-3xl border bg-white p-8 text-center">
        <div className="max-w-md">
          <div className="text-4xl">⌖</div>
          <h2 className="mt-3 text-lg font-black">Xarita hozircha sozlanmagan</h2>
          <p className="mt-2 text-sm text-slate-500">{error} Vercel Environment Variables’da <b>NEXT_PUBLIC_YANDEX_MAPS_API_KEY</b> qiymatini qo‘shing.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div ref={containerRef} className="h-[62vh] min-h-[520px] w-full md:h-[680px]" />
      <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
        <div className="rounded-full bg-white/95 px-4 py-2 text-xs font-black shadow-lg backdrop-blur">
          {loading ? 'Yuklanmoqda…' : `${listings.length}${listings.length >= 500 ? '+' : ''} ta e’lon xaritada`}
        </div>
        <button onClick={() => router.push(`/listings?${searchParams}`)} className="rounded-full bg-white/95 px-4 py-2 text-xs font-black shadow-lg backdrop-blur">
          Ro‘yxatga qaytish
        </button>
      </div>
      {error && apiReady && <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-lg">{error}</div>}
    </div>
  )
}
