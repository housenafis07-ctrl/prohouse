'use client'

import { useEffect, useRef, useState } from 'react'

declare global { interface Window { L?: any } }

type Props = { latitude: number | null; longitude: number | null; onChange: (latitude: number, longitude: number) => void }
const TASHKENT: [number, number] = [41.2995, 69.2401]

export default function ListingLocationPicker({ latitude, longitude, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const cssId = 'leaflet-css'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    const init = () => {
      if (!containerRef.current || !window.L || mapRef.current) return
      const initial: [number, number] = latitude != null && longitude != null ? [latitude, longitude] : TASHKENT
      const map = window.L.map(containerRef.current, { scrollWheelZoom: true }).setView(initial, latitude != null ? 15 : 11)
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
      map.on('click', (event: any) => onChange(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6))))
      mapRef.current = map
      setReady(true)
      if (latitude != null && longitude != null) markerRef.current = window.L.circleMarker(initial, { radius: 9 }).addTo(map)
      setTimeout(() => map.invalidateSize(), 100)
    }
    if (window.L) init()
    else {
      const existing = document.getElementById('leaflet-js') as HTMLScriptElement | null
      if (existing) existing.addEventListener('load', init)
      else {
        const script = document.createElement('script')
        script.id = 'leaflet-js'; script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.async = true; script.onload = init
        script.onerror = () => setError('Xarita yuklanmadi. Internet ulanishini tekshiring.')
        document.body.appendChild(script)
      }
    }
    return () => { const script = document.getElementById('leaflet-js'); script?.removeEventListener('load', init); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current || !window.L || latitude == null || longitude == null) return
    const position: [number, number] = [latitude, longitude]
    if (markerRef.current) markerRef.current.setLatLng(position)
    else markerRef.current = window.L.circleMarker(position, { radius: 9 }).addTo(mapRef.current)
    mapRef.current.panTo(position)
  }, [latitude, longitude, ready])

  const locateMe = () => {
    setError('')
    if (!navigator.geolocation) return setError('Brauzer geolokatsiyani qo‘llab-quvvatlamaydi.')
    navigator.geolocation.getCurrentPosition(
      position => onChange(Number(position.coords.latitude.toFixed(6)), Number(position.coords.longitude.toFixed(6))),
      () => setError('Joylashuvni aniqlashga ruxsat berilmadi.')
    )
  }

  return <div>
    <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
      <div><p className="text-sm font-bold text-slate-700">Xaritada mulk joylashuvini belgilang *</p><p className="text-xs text-slate-500">Xaritadagi aniq nuqtani bosing. Joylashuv koordinatalari e’lon bilan saqlanadi.</p></div>
      <button type="button" onClick={locateMe} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">📍 Mening joylashuvim</button>
    </div>
    <div ref={containerRef} className="h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100" />
    <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{latitude != null && longitude != null ? <><b className="text-slate-900">Tanlangan nuqta:</b> {latitude}, {longitude}</> : 'Hali nuqta tanlanmagan — xaritani bosing.'}</div>
    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
  </div>
}
