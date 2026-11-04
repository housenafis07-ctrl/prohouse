'use client'

import { useEffect, useRef, useState } from 'react'

declare global { interface Window { maplibregl?: any } }

type Position = [number, number]
type MapFeature = {
  type: 'Feature'
  id?: string
  properties: { kind: 'complex' | 'building' | 'infrastructure'; name: string; category?: string; height?: number; source?: string }
  geometry: { type: 'Polygon' | 'Point'; coordinates: any }
}
type MapData = { type: 'FeatureCollection'; features: MapFeature[] }
type Mode = 'complex' | 'building' | 'select' | 'infrastructure'
type Props = {
  value: MapData
  onChange: (value: MapData, center: { latitude: number; longitude: number }) => void
  latitude?: number | null
  longitude?: number | null
}

const empty: MapData = { type: 'FeatureCollection', features: [] }
const categories = [
  { value: 'school', label: 'Maktab', emoji: '🏫' },
  { value: 'kindergarten', label: 'Bog‘cha', emoji: '🧸' },
  { value: 'hospital', label: 'Shifoxona', emoji: '🏥' },
  { value: 'supermarket', label: 'Supermarket', emoji: '🛒' },
  { value: 'transport', label: 'Transport bekati', emoji: '🚌' },
  { value: 'other', label: 'Boshqa', emoji: '📍' },
]

export default function ResidentialComplexMap({ value, onChange, latitude, longitude }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const draft = useRef<Position[]>([])
  const data = useRef<MapData>(value || empty)
  const [mode, setMode] = useState<Mode>('complex')
  const modeRef = useRef<Mode>('complex')
  const categoryRef = useRef('school')
  const nameRef = useRef('')
  modeRef.current = mode
  categoryRef.current = category
  nameRef.current = name
  const [points, setPoints] = useState<Position[]>([])
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('Majmua hududini chizish uchun xaritada kamida 3 nuqtani belgilang.')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('school')
  const [is3d, setIs3d] = useState(true)
  const [showInfrastructure, setShowInfrastructure] = useState(true)
  const [selectedBuilding, setSelectedBuilding] = useState<{ name: string; height: number; source: string } | null>(null)

  useEffect(() => {
    data.current = value || empty
    map.current?.getSource('developer-polygons')?.setData(data.current)
  }, [value])

  useEffect(() => {
    let disposed = false
    const loadCss = () => {
      if (!document.querySelector('link[data-residential-maplibre]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.12.0/maplibre-gl.min.css'
        link.dataset.residentialMaplibre = 'true'
        document.head.appendChild(link)
      }
    }
    const init = () => {
      if (disposed || !container.current || !window.maplibregl) return
      const m = new window.maplibregl.Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [longitude ?? 69.2401, latitude ?? 41.2995],
        zoom: latitude != null && longitude != null ? 16 : 12,
        pitch: 55,
        bearing: -17,
        antialias: true,
      })
      map.current = m
      m.addControl(new window.maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
      m.on('load', () => {
        if (disposed) return
        m.addSource('developer-polygons', { type: 'geojson', data: data.current })
        m.addLayer({
          id: 'developer-complex-fill', type: 'fill', source: 'developer-polygons',
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': ['match', ['get', 'kind'], 'building', '#f59e0b', '#159b72'], 'fill-opacity': 0.3 },
        })
        m.addLayer({
          id: 'developer-complex-extrusion', type: 'fill-extrusion', source: 'developer-polygons',
          filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'kind'], 'building']],
          paint: {
            'fill-extrusion-color': '#e99a22',
            'fill-extrusion-opacity': 0.78,
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 12],
            'fill-extrusion-base': 0,
          },
        })
        m.addLayer({
          id: 'developer-complex-line', type: 'line', source: 'developer-polygons',
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'line-color': ['match', ['get', 'kind'], 'building', '#d97706', '#047857'], 'line-width': 3 },
        })
        m.addLayer({
          id: 'developer-infrastructure-points', type: 'circle', source: 'developer-polygons',
          filter: ['==', ['get', 'kind'], 'infrastructure'],
          paint: { 'circle-radius': 7, 'circle-color': '#2563eb', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
        })
        m.addLayer({
          id: 'developer-infrastructure-labels', type: 'symbol', source: 'developer-polygons',
          filter: ['==', ['get', 'kind'], 'infrastructure'],
          layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-allow-overlap': false },
          paint: { 'text-color': '#1e3a8a', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
        })
        m.on('click', (event: any) => {
          const point: Position = [event.lngLat.lng, event.lngLat.lat]
          if (modeRef.current === 'select') {
            selectExistingBuilding(event.point, point)
            return
          }
          if (modeRef.current === 'infrastructure') {
            const item = categories.find(x => x.value === categoryRef.current)
            const feature: MapFeature = {
              type: 'Feature',
              properties: { kind: 'infrastructure', category: categoryRef.current, name: nameRef.current.trim() || item?.label || 'Infratuzilma' },
              geometry: { type: 'Point', coordinates: point },
            }
            const next = { type: 'FeatureCollection' as const, features: [...data.current.features, feature] }
            data.current = next
            m.getSource('developer-polygons')?.setData(next)
            onChange(next, { latitude: point[1], longitude: point[0] })
            setMessage('Infratuzilma nuqtasi qo‘shildi. Yana nuqta qo‘shishingiz mumkin.')
            return
          }
          draft.current = [...draft.current, point]
          setPoints(draft.current)
          onChange(data.current, { latitude: point[1], longitude: point[0] })
          setMessage(`Chizilayotgan kontur nuqtalari: ${draft.current.length}. Kamida 3 ta nuqta belgilang.`)
        })
        setReady(true)
      })
    }
    loadCss()
    if (window.maplibregl) init()
    else {
      const existing = document.querySelector('script[data-residential-maplibre]') as HTMLScriptElement | null
      if (existing) existing.addEventListener('load', init, { once: true })
      else {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.12.0/maplibre-gl.min.js'
        script.dataset.residentialMaplibre = 'true'
        script.onload = init
        document.body.appendChild(script)
      }
    }
    return () => { disposed = true; map.current?.remove(); map.current = null }
  }, [])

  useEffect(() => {
    if (!map.current || !ready) return
    map.current.easeTo({ pitch: is3d ? 55 : 0, bearing: is3d ? -17 : 0, duration: 450 })
  }, [is3d, ready])

  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const style = m.getStyle()
    for (const layer of style.layers || []) {
      if (/poi|place-label|transit|airport|housenumber/i.test(layer.id)) {
        try { m.setLayoutProperty(layer.id, 'visibility', showInfrastructure ? 'visible' : 'none') } catch {}
      }
    }
    for (const id of ['developer-infrastructure-points', 'developer-infrastructure-labels']) {
      if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', showInfrastructure ? 'visible' : 'none')
    }
  }, [showInfrastructure, ready])

  function selectExistingBuilding(screenPoint: any, click: Position) {
    const m = map.current
    if (!m) return
    const features = m.queryRenderedFeatures([
      [screenPoint.x - 5, screenPoint.y - 5],
      [screenPoint.x + 5, screenPoint.y + 5],
    ])
    const candidate = features.find((feature: any) => {
      const p = feature.properties || {}
      return feature.geometry && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type) &&
        (feature.sourceLayer === 'building' || p.render_height != null || p.height != null)
    })
    if (!candidate) {
      setMessage('Bu nuqtada bino topilmadi. Xaritani yaqinlashtirib, bino ustiga bosing.')
      return
    }
    const p = candidate.properties || {}
    const parsedHeight = Number.parseFloat(String(p.render_height ?? p.height ?? ''))
    const height = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 9
    const geometry = candidate.geometry.type === 'Polygon'
      ? candidate.geometry
      : { type: 'Polygon', coordinates: candidate.geometry.coordinates[0] }
    const feature: MapFeature = {
      type: 'Feature',
      properties: { kind: 'building', name: nameRef.current.trim() || p.name || 'Xaritadan tanlangan korpus', height, source: parsedHeight > 0 ? 'map-height' : 'estimated-height' },
      geometry,
    }
    const next = { type: 'FeatureCollection' as const, features: [...data.current.features, feature] }
    data.current = next
    m.getSource('developer-polygons')?.setData(next)
    onChange(next, { latitude: click[1], longitude: click[0] })
    setSelectedBuilding({ name: feature.properties.name, height, source: parsedHeight > 0 ? 'Xarita ma’lumoti' : 'Taxminiy balandlik: 3 qavat' })
    setMessage('Xaritadagi mavjud bino tanlandi va korpus konturi sifatida saqlandi.')
  }

  function finishPolygon() {
    if (draft.current.length < 3) { setMessage('Kontur uchun kamida 3 ta nuqta kerak.'); return }
    const ring = [...draft.current, draft.current[0]]
    const isComplex = mode === 'complex'
    const feature: MapFeature = {
      type: 'Feature',
      properties: { kind: mode as 'complex' | 'building', name: name.trim() || (isComplex ? 'Majmua hududi' : `Korpus ${data.current.features.filter(x => x.properties.kind === 'building').length + 1}`), height: isComplex ? undefined : 12 },
      geometry: { type: 'Polygon', coordinates: [ring] },
    }
    const next = {
      type: 'FeatureCollection' as const,
      features: [...data.current.features.filter(x => !(x.properties.kind === 'complex' && isComplex)), feature],
    }
    data.current = next
    map.current?.getSource('developer-polygons')?.setData(next)
    onChange(next, { latitude: ring[0][1], longitude: ring[0][0] })
    draft.current = []
    setPoints([])
    setMessage(isComplex ? 'Majmua hududi saqlandi. Endi korpuslarni chizing yoki xaritadagi mavjud binoni tanlang.' : 'Korpus konturi saqlandi.')
  }

  function undoPoint() { draft.current = draft.current.slice(0, -1); setPoints(draft.current); setMessage(`Nuqtalar: ${draft.current.length}`) }
  function clearDraft() { draft.current = []; setPoints([]); setMessage('Yangi kontur chizish uchun xaritani bosing.') }

  const modes: { value: Mode; label: string }[] = [
    { value: 'complex', label: 'Majmua hududi' },
    { value: 'building', label: 'Korpus chizish' },
    { value: 'select', label: 'Mavjud binoni tanlash' },
    { value: 'infrastructure', label: 'Infratuzilma qo‘shish' },
  ]

  return <section className="overflow-hidden rounded-2xl border border-slate-200">
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4">
      <div><h2 className="font-black text-slate-900">Majmua xaritasi</h2><p className="mt-1 text-xs text-slate-500">Soya loyihasidagi MapLibre va OpenFreeMap texnologiyasi asosida</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setIs3d(v => !v)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">{is3d ? '2D ko‘rinish' : '3D ko‘rinish'}</button>
        <button type="button" onClick={() => setShowInfrastructure(v => !v)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">{showInfrastructure ? 'Infratuzilmani yashirish' : 'Infratuzilmani ko‘rsatish'}</button>
      </div>
    </div>
    <div className="flex flex-wrap gap-2 border-t bg-white px-4 py-3">
      {modes.map(item => <button key={item.value} type="button" onClick={() => { setMode(item.value); clearDraft() }} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === item.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{item.label}</button>)}
    </div>
    <div className="relative"><div ref={container} className="h-[440px] w-full bg-slate-100" />{!ready && <div className="absolute inset-0 grid place-items-center bg-slate-100/90 text-sm text-slate-600">Xarita yuklanmoqda...</div>}</div>
    {(mode === 'complex' || mode === 'building' || mode === 'infrastructure') && <div className="flex flex-wrap items-center gap-2 bg-white p-4">
      {mode === 'infrastructure' && <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">{categories.map(item => <option key={item.value} value={item.value}>{item.emoji} {item.label}</option>)}</select>}
      <input value={name} onChange={e => setName(e.target.value)} placeholder={mode === 'complex' ? 'Majmua hududi nomi' : mode === 'building' ? 'Korpus nomi (masalan, 1-korpus)' : 'Obyekt nomi (masalan, 12-maktab)'} className="min-w-[190px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      {mode !== 'infrastructure' && <><button type="button" onClick={finishPolygon} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white">Kontur tugatish</button><button type="button" onClick={undoPoint} disabled={!points.length} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold disabled:opacity-40">Orqaga</button><button type="button" onClick={clearDraft} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">Tozalash</button></>}
    </div>}
    {selectedBuilding && <div className="border-t bg-amber-50 px-4 py-3 text-xs text-amber-900">Tanlangan bino: <b>{selectedBuilding.name}</b> · Balandligi: <b>{selectedBuilding.height.toFixed(1)} m</b> · {selectedBuilding.source}</div>}
    <p className="border-t bg-slate-50 px-4 py-3 text-xs text-slate-600">{message} Saqlangan konturlar va nuqtalar: {data.current.features.length} ta.</p>
  </section>
}
