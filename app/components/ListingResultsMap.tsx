'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

declare global { interface Window { L?: any } }

type ListingMapItem = { id: string; title: string; price: number; currency: string; latitude: number | null; longitude: number | null }
const money = (value: number, currency: string) => `${new Intl.NumberFormat('ru-RU').format(value)} ${currency === 'USD' ? 'у.е.' : 'сум'}`

export default function ListingResultsMap({ listings }: { listings: ListingMapItem[] }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    const init = () => {
      if (!ref.current || !window.L || mapRef.current) return
      const points = listings.filter(x => x.latitude != null && x.longitude != null)
      const center: [number, number] = points.length ? [points[0].latitude!, points[0].longitude!] : [41.2995, 69.2401]
      const map = window.L.map(ref.current, { scrollWheelZoom: true }).setView(center, points.length ? 12 : 11)
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 100)
    }
    const cssId = 'leaflet-css-results'
    if (!document.getElementById(cssId)) { const link = document.createElement('link'); link.id = cssId; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link) }
    if (window.L) init()
    else {
      const existing = document.getElementById('leaflet-js-results') as HTMLScriptElement | null
      if (existing) existing.addEventListener('load', init)
      else { const script = document.createElement('script'); script.id = 'leaflet-js-results'; script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.async = true; script.onload = init; document.body.appendChild(script) }
    }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !window.L) return
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []
    const points = listings.filter(x => x.latitude != null && x.longitude != null)
    points.forEach(item => {
      const marker = window.L.marker([item.latitude, item.longitude]).addTo(mapRef.current)
      marker.bindPopup(`<div style="min-width:180px"><b>${money(item.price, item.currency)}</b><br/><span>${String(item.title).replace(/</g, '&lt;')}</span><br/><a href="/listings/${item.id}" style="display:inline-block;margin-top:8px;color:#059669;font-weight:700">Batafsil →</a></div>`)
      markersRef.current.push(marker)
    })
    if (points.length > 1) mapRef.current.fitBounds(window.L.latLngBounds(points.map(x => [x.latitude, x.longitude])).pad(0.12))
    else if (points.length === 1) mapRef.current.setView([points[0].latitude, points[0].longitude], 15)
    setTimeout(() => mapRef.current?.invalidateSize(), 100)
  }, [listings])

  const count = listings.filter(x => x.latitude != null && x.longitude != null).length
  return <div className="relative h-full min-h-[620px]"><div ref={ref} className="absolute inset-0" />{count === 0 && <div className="absolute left-4 right-4 top-4 z-[500] rounded-xl bg-white/95 px-4 py-3 text-sm font-semibold text-slate-600 shadow">Bu filtrda xarita koordinatasi mavjud e’lon yo‘q.</div>}<div className="absolute bottom-4 left-4 right-4 z-[500] rounded-xl bg-white/95 p-3 shadow"><p className="text-xs text-slate-500">{count} ta e’lon xaritada</p><Link href="/listings" className="mt-2 block rounded-lg bg-emerald-500 py-2.5 text-center text-sm font-bold text-white">Barcha e’lonlar</Link></div></div>
}
