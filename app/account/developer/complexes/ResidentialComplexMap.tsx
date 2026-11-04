'use client'

import { useEffect, useRef, useState } from 'react'

declare global { interface Window { maplibregl?: any } }

type Position = [number, number]
type MapFeature = { type: 'Feature'; properties: { kind: 'complex' | 'building'; name: string }; geometry: { type: 'Polygon'; coordinates: Position[][] } }
type MapData = { type: 'FeatureCollection'; features: MapFeature[] }

type Props = {
  value: MapData
  onChange: (value: MapData, center: { latitude: number; longitude: number }) => void
  latitude?: number | null
  longitude?: number | null
}

const empty: MapData = { type: 'FeatureCollection', features: [] }

export default function ResidentialComplexMap({ value, onChange, latitude, longitude }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const draft = useRef<Position[]>([])
  const data = useRef<MapData>(value || empty)
  const [mode, setMode] = useState<'complex' | 'building'>('complex')
  const [points, setPoints] = useState<Position[]>([])
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('Xaritada nuqtalarni bosib hudud konturini chizing.')
  const [name, setName] = useState('')

  useEffect(() => { data.current = value || empty; if (map.current?.getSource('developer-polygons')) map.current.getSource('developer-polygons').setData(data.current as any) }, [value])

  useEffect(() => {
    let disposed = false
    const loadCss = () => {
      if (!document.querySelector('link[data-residential-maplibre]')) {
        const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.12.0/maplibre-gl.min.css'; link.dataset.residentialMaplibre = 'true'; document.head.appendChild(link)
      }
    }
    const init = () => {
      if (disposed || !container.current || !window.maplibregl) return
      const m = new window.maplibregl.Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty', center: [longitude ?? 69.2401, latitude ?? 41.2995], zoom: latitude && longitude ? 16 : 12, pitch: 35, antialias: true })
      map.current = m
      m.addControl(new window.maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
      m.on('load', () => {
        if (disposed) return
        m.addSource('developer-polygons', { type: 'geojson', data: data.current })
        m.addLayer({ id: 'developer-polygons-fill', type: 'fill', source: 'developer-polygons', paint: { 'fill-color': ['match', ['get', 'kind'], 'building', '#f59e0b', '#159b72'], 'fill-opacity': 0.35 } })
        m.addLayer({ id: 'developer-polygons-line', type: 'line', source: 'developer-polygons', paint: { 'line-color': ['match', ['get', 'kind'], 'building', '#d97706', '#047857'], 'line-width': 3 } })
        m.on('click', (event: any) => {
          const point: Position = [event.lngLat.lng, event.lngLat.lat]
          draft.current = [...draft.current, point]; setPoints(draft.current)
          onChange(data.current, { latitude: point[1], longitude: point[0] })
          setMessage(`Nuqtalar: ${draft.current.length}. Kamida 3 ta nuqta belgilang, keyin kontur tugmasini bosing.`)
        })
        setReady(true)
      })
    }
    loadCss()
    if (window.maplibregl) init()
    else {
      const existing = document.querySelector('script[data-residential-maplibre]') as HTMLScriptElement | null
      if (existing) existing.addEventListener('load', init, { once: true })
      else { const script = document.createElement('script'); script.src = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.12.0/maplibre-gl.min.js'; script.dataset.residentialMaplibre = 'true'; script.onload = init; document.body.appendChild(script) }
    }
    return () => { disposed = true; map.current?.remove(); map.current = null }
  }, [])

  function finishPolygon() {
    if (draft.current.length < 3) { setMessage('Kontur uchun kamida 3 ta nuqta kerak.'); return }
    const ring = [...draft.current, draft.current[0]]
    const feature: MapFeature = { type: 'Feature', properties: { kind: mode, name: name.trim() || (mode === 'complex' ? 'Majmua hududi' : `Korpus ${data.current.features.filter(x => x.properties.kind === 'building').length + 1}`) }, geometry: { type: 'Polygon', coordinates: [ring] } }
    const next = { type: 'FeatureCollection' as const, features: [...data.current.features.filter(x => !(x.properties.kind === mode && mode === 'complex')), feature] }
    data.current = next; map.current?.getSource('developer-polygons')?.setData(next); onChange(next, { latitude: ring[0][1], longitude: ring[0][0] })
    draft.current = []; setPoints([]); setMessage(mode === 'complex' ? 'Majmua hududi saqlandi. Endi korpus rejimida alohida binolarni chizing.' : 'Korpus konturi saqlandi.')
  }

  function undoPoint() { draft.current = draft.current.slice(0, -1); setPoints(draft.current); setMessage(`Nuqtalar: ${draft.current.length}`) }
  function clearDraft() { draft.current = []; setPoints([]); setMessage('Yangi kontur chizish uchun xaritani bosing.') }

  return <section className="overflow-hidden rounded-2xl border border-slate-200">
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4">
      <div><h2 className="font-black text-slate-900">Majmua xaritasi</h2><p className="mt-1 text-xs text-slate-500">Soya loyihasidagi MapLibre xarita texnologiyasi asosida</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => { setMode('complex'); clearDraft() }} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'complex' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Majmua hududi</button><button type="button" onClick={() => { setMode('building'); clearDraft() }} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'building' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700'}`}>Korpus konturi</button></div>
    </div>
    <div className="relative"><div ref={container} className="h-[420px] w-full bg-slate-100" />{!ready && <div className="absolute inset-0 grid place-items-center bg-slate-100/90 text-sm text-slate-600">Xarita yuklanmoqda...</div>}</div>
    <div className="flex flex-wrap items-center gap-2 bg-white p-4">
      <input value={name} onChange={e => setName(e.target.value)} placeholder={mode === 'complex' ? 'Majmua hududi nomi' : 'Korpus nomi (masalan, 1-korpus)'} className="min-w-[190px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <button type="button" onClick={finishPolygon} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white">Kontur tugatish</button>
      <button type="button" onClick={undoPoint} disabled={!points.length} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold disabled:opacity-40">Orqaga</button>
      <button type="button" onClick={clearDraft} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">Tozalash</button>
    </div>
    <p className="border-t bg-slate-50 px-4 py-3 text-xs text-slate-600">{message} Saqlangan konturlar: {data.current.features.length} ta.</p>
  </section>
}
