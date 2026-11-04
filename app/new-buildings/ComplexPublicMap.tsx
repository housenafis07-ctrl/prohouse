'use client'

import { useEffect, useRef, useState } from 'react'

declare global { interface Window { maplibregl?: any } }

type Props = {
  mapData: { type?: string; features?: any[] } | null
  latitude?: number | null
  longitude?: number | null
  buildings: Array<{ id: string; name: string; units_total: number | null }>
}

export default function ComplexPublicMap({ mapData, latitude, longitude, buildings }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [selected, setSelected] = useState<{ id: string; name: string; units: number } | null>(null)
  const features = (mapData?.features || []).filter(feature =>
    feature?.type === 'Feature' &&
    ['complex', 'building', 'infrastructure'].includes(feature.properties?.kind) &&
    feature.geometry
  )
  const data = { type: 'FeatureCollection', features }

  useEffect(() => {
    let disposed = false
    const init = () => {
      if (disposed || !container.current || !window.maplibregl) return
      const m = new window.maplibregl.Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [longitude ?? 69.2401, latitude ?? 41.2995],
        zoom: latitude != null && longitude != null ? 16 : 12,
        pitch: 48,
        bearing: -15,
        antialias: true,
      })
      map.current = m
      m.addControl(new window.maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
      m.on('load', () => {
        if (disposed) return
        m.addSource('complex-public-data', { type: 'geojson', data })
        m.addLayer({
          id: 'complex-public-fill', type: 'fill', source: 'complex-public-data',
          filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['in', ['get', 'kind'], ['literal', ['complex', 'building']]]],
          paint: { 'fill-color': ['match', ['get', 'kind'], 'building', '#f59e0b', '#059669'], 'fill-opacity': 0.34 },
        })
        m.addLayer({
          id: 'complex-public-extrusion', type: 'fill-extrusion', source: 'complex-public-data',
          filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'kind'], 'building']],
          paint: { 'fill-extrusion-color': '#e99a22', 'fill-extrusion-opacity': 0.8, 'fill-extrusion-height': ['coalesce', ['get', 'height'], 12], 'fill-extrusion-base': 0 },
        })
        m.addLayer({
          id: 'complex-public-line', type: 'line', source: 'complex-public-data',
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'line-color': ['match', ['get', 'kind'], 'building', '#b45309', '#047857'], 'line-width': 3 },
        })
        m.addLayer({
          id: 'complex-public-infrastructure', type: 'circle', source: 'complex-public-data',
          filter: ['==', ['get', 'kind'], 'infrastructure'],
          paint: { 'circle-radius': 6, 'circle-color': '#2563eb', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
        })
        m.on('click', 'complex-public-fill', (event: any) => {
          const feature = event.features?.find((item: any) => item.properties?.kind === 'building' && item.properties?.building_id)
          if (!feature) { setSelected(null); return }
          const id = String(feature.properties.building_id)
          const building = buildings.find(item => item.id === id)
          if (!building) return
          setSelected({ id, name: building.name, units: building.units_total || 0 })
        })
        m.on('mouseenter', 'complex-public-fill', () => { m.getCanvas().style.cursor = 'pointer' })
        m.on('mouseleave', 'complex-public-fill', () => { m.getCanvas().style.cursor = '' })
      })
    }
    if (!document.querySelector('link[data-complex-public-map]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.12.0/maplibre-gl.min.css'
      link.dataset.complexPublicMap = 'true'
      document.head.appendChild(link)
    }
    if (window.maplibregl) init()
    else {
      const existing = document.querySelector('script[data-complex-public-map]') as HTMLScriptElement | null
      if (existing) existing.addEventListener('load', init, { once: true })
      else {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.12.0/maplibre-gl.min.js'
        script.dataset.complexPublicMap = 'true'
        script.onload = init
        document.body.appendChild(script)
      }
    }
    return () => { disposed = true; map.current?.remove(); map.current = null }
  }, [])

  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
    <div className="flex items-center justify-between gap-3 p-5">
      <div><h2 className="text-xl font-black">Majmua xaritasi</h2><p className="mt-1 text-sm text-slate-500">Korpusni tanlab, xonadonlarini ko‘ring</p></div>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Interaktiv 2D / 3D</span>
    </div>
    <div ref={container} className="h-[420px] w-full bg-slate-100" />
    {selected && <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-amber-50 p-4">
      <div><p className="font-black text-slate-900">{selected.name}</p><p className="text-xs text-slate-600">{selected.units} ta xonadon (reja)</p></div>
      <a href={`#building-${selected.id}`} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Xonadonlarni ko‘rish</a>
    </div>}
  </section>
}
