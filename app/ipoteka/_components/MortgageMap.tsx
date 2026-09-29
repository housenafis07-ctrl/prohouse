'use client'
import { useEffect } from 'react'
import type { MortgageMarket } from '@/lib/mortgage-programs'

const money=(n:number)=>new Intl.NumberFormat('ru-RU').format(Math.round(n))+' so‘m'

export default function MortgageMap({items,market}:{items:any[];market:MortgageMarket}){
 const mapId='mortgage-map-'+market
 useEffect(()=>{
  if(!items.length)return
  const init=()=>{
   const L=(window as any).L
   const el=document.getElementById(mapId)
   if(!L||!el)return
   const old=(el as any).__map
   if(old)old.remove()
   const map=L.map(el).setView([41.3,69.25],11)
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map)
   const points=items.map(x=>[Number(x.latitude),Number(x.longitude)] as [number,number])
   points.forEach((point,i)=>{
    const x=items[i]
    const marker=L.marker(point).addTo(map)
    marker.bindPopup('<b>'+String(x.title||'Royalhouse').replace(/</g,'&lt;')+'</b><br/>'+money(Number(x.price)))
   })
   if(points.length)map.fitBounds(points,{padding:[30,30],maxZoom:13})
   ;(el as any).__map=map
   setTimeout(()=>map.invalidateSize(),100)
  }
  const scriptId='royalhouse-leaflet-js'
  if((window as any).L){init();return}
  const existing=document.getElementById(scriptId) as HTMLScriptElement|null
  if(existing){existing.addEventListener('load',init);return()=>existing.removeEventListener('load',init)}
  const script=document.createElement('script')
  script.id=scriptId;script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.async=true;script.onload=init
  document.body.appendChild(script)
  return()=>{script.onload=null}
 },[items,mapId])
 return <div><div id={mapId} className="h-[420px] w-full rounded-3xl border border-slate-200 bg-slate-100"/><p className="mt-2 text-xs text-slate-400">Faqat “Ipotekaga mumkin” belgisi qo‘yilgan faol e’lonlar xaritada ko‘rsatiladi.</p></div>
}
