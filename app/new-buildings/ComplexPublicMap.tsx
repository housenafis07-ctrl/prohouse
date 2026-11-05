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
  const [shadowEnabled, setShadowEnabled] = useState(true)
  const [shadowDate, setShadowDate] = useState(new Date().toISOString().slice(0, 10))
  const [shadowTime, setShadowTime] = useState('15:00')
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
        m.addSource('complex-public-shadows', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        m.addLayer({ id: 'complex-public-shadow-fill', type: 'fill', source: 'complex-public-shadows', paint: { 'fill-color': '#111827', 'fill-opacity': 0.38 } })
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
        loadSunCalc().then(() => updateShadows(m)).catch(() => {})
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

  function loadSunCalc(): Promise<void> {
    if ((window as any).SunCalc) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-royalhouse-suncalc]') as HTMLScriptElement | null
      if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('SunCalc load failed')), { once: true }); return }
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/suncalc/1.9.0/suncalc.min.js'
      script.dataset.royalhouseSuncalc = 'true'; script.onload = () => resolve(); script.onerror = () => reject(new Error('SunCalc load failed')); document.head.appendChild(script)
    })
  }
  function updateShadows(m = map.current) {
    const source = m?.getSource('complex-public-shadows')
    if (!source || !(window as any).SunCalc) return
    if (!shadowEnabled) { source.setData({ type: 'FeatureCollection', features: [] }); return }
    const [y,mo,d]=shadowDate.split('-').map(Number),[h,mi]=shadowTime.split(':').map(Number)
    if (![y,mo,d,h,mi].every(Number.isFinite)) return
    const dt=new Date(y,mo-1,d,h,mi)
    const shadows=features.filter(f=>f.properties?.kind==='building'&&f.geometry?.type==='Polygon').flatMap(feature=>{
      const ring=feature.geometry.coordinates?.[0]||[],pts=ring.slice(0,-1)
      if(pts.length<3)return[]
      const center=[pts.reduce((a:number,p:number[])=>a+p[0],0)/pts.length,pts.reduce((a:number,p:number[])=>a+p[1],0)/pts.length]
      const sun=(window as any).SunCalc.getPosition(dt,center[1],center[0]);if(sun.altitude<=0.01)return[]
      const height=Math.max(1,Number(feature.properties?.height)||12),len=Math.min(1500,height/Math.tan(sun.altitude)),dx=-len*Math.sin(sun.azimuth),dy=len*Math.cos(sun.azimuth)
      const latScale=1/111320,lngScale=1/(111320*Math.max(.1,Math.cos(center[1]*Math.PI/180)))
      const all=pts.concat(pts.map((p:number[])=>[p[0]+dx*lngScale,p[1]+dy*latScale]))
      const sorted=all.slice().sort((a:number[],b:number[])=>a[0]-b[0]||a[1]-b[1]),cross=(o:number[],a:number[],b:number[])=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo:number[][]=[],up:number[][]=[]
      for(const p of sorted){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}
      for(const p of sorted.slice().reverse()){while(up.length>=2&&cross(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
      lo.pop();up.pop();const hull=lo.concat(up);if(hull.length<3)return[];hull.push(hull[0])
      return[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[hull]}}]
    })
    source.setData({type:'FeatureCollection',features:shadows})
  }
  useEffect(()=>{if(!map.current)return;loadSunCalc().then(()=>updateShadows()).catch(()=>{})},[shadowEnabled,shadowDate,shadowTime,mapData])

  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
    <div className="flex items-center justify-between gap-3 p-5">
      <div><h2 className="text-xl font-black">Majmua xaritasi</h2><p className="mt-1 text-sm text-slate-500">Korpusni tanlab, xonadonlarini ko‘ring</p></div>
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Interaktiv 2D / 3D</span><button type="button" onClick={()=>setShadowEnabled(v=>!v)} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">{shadowEnabled?'Soyani yashirish':'Soyani ko‘rsatish'}</button></div>
    </div>
    <div className="flex flex-wrap gap-3 border-t bg-slate-50 px-4 py-3"><label className="text-xs font-bold text-slate-600">Sana <input type="date" value={shadowDate} onChange={e=>setShadowDate(e.target.value)} className="ml-2 rounded-lg border px-2 py-1"/></label><label className="text-xs font-bold text-slate-600">Vaqt <input type="time" value={shadowTime} onChange={e=>setShadowTime(e.target.value)} className="ml-2 rounded-lg border px-2 py-1"/></label><span className="self-center text-xs text-slate-500">Quyosh yo‘nalishi bo‘yicha hisoblangan soya</span></div>
    <div ref={container} className="h-[420px] w-full bg-slate-100" />
    {selected && <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-amber-50 p-4">
      <div><p className="font-black text-slate-900">{selected.name}</p><p className="text-xs text-slate-600">{selected.units} ta xonadon (reja)</p></div>
      <a href={`#building-${selected.id}`} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Xonadonlarni ko‘rish</a>
    </div>}
  </section>
}
