'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { formatMoney } from '@/lib/money'
import { useI18n } from '@/app/components/I18nProvider'

type Item = {
  id:string; title:string; title_ru?:string|null; price:number; currency:string; city:string; district:string|null;
  area_m2:number|null; rooms:number|null; floor:number|null; floors_total:number|null; property_type:string|null;
  is_mortgage_available:boolean; latitude:number|null; longitude:number|null; listing_type:string; primary_image_url?:string|null
}

const KEY='royalhouse-compare'

export default function ComparePage(){
  const {lang}=useI18n(); const ru=lang==='ru'
  const [ids,setIds]=useState<string[]>([])
  const [items,setItems]=useState<Item[]>([])
  const [loading,setLoading]=useState(true)

  useEffect(()=>{try{setIds(JSON.parse(localStorage.getItem(KEY)||'[]').slice(0,3))}catch{setIds([])}},[])
  useEffect(()=>{
    if(!ids.length){setItems([]);setLoading(false);return}
    const load=async()=>{setLoading(true);const db=createClient();const {data}=await db.from('listings').select('id,title,title_ru,price,currency,city,district,area_m2,rooms,floor,floors_total,property_type,is_mortgage_available,latitude,longitude,listing_type,primary_image_url').in('id',ids).eq('status','active');setItems(((data||[]).sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id))) as Item[]);setLoading(false)}
    void load()
  },[ids])

  const remove=(id:string)=>{const next=ids.filter(x=>x!==id);setIds(next);localStorage.setItem(KEY,JSON.stringify(next))}
  const rows:[string,(x:Item)=>string][]=[
    [ru?'Цена':'Narx',x=>formatMoney(x.price,x.currency,lang)],
    [ru?'Площадь':'Maydon',x=>x.area_m2!=null?x.area_m2+' m²':'—'],
    [ru?'Комнаты':'Xonalar',x=>x.rooms!=null?String(x.rooms):'—'],
    [ru?'Цена за м²':'1 m² narxi',x=>x.area_m2?formatMoney(x.price/x.area_m2,x.currency,lang):'—'],
    [ru?'Первоначальный взнос (20%)':'Boshlang‘ich badal (20%)',x=>x.is_mortgage_available?formatMoney(x.price*0.2,x.currency,lang):'—'],
    [ru?'Ипотечный платёж*':'Ipoteka to‘lovi*',x=>x.is_mortgage_available?formatMoney(x.price*0.8*0.0215/(1-Math.pow(1+0.0215,-240)),x.currency,lang):'—'],
    [ru?'Ипотека':'Ipoteka',x=>x.is_mortgage_available?(ru?'Да':'Ha'):(ru?'Нет':'Yo‘q')],
    [ru?'Расположение':'Joylashuv',x=>[x.city,x.district].filter(Boolean).join(', ')],
  ]

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4"><Link href="/listings" className="font-black text-emerald-700">← {ru?'Объявления':'E’lonlar'}</Link><Link href="/" className="text-xl font-black">Royal<span className="text-emerald-500">house</span></Link></div></header>
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black tracking-widest text-emerald-600">ROYALHOUSE</p><h1 className="mt-2 text-3xl font-black">{ru?'Сравнение объектов':'Uylarni solishtirish'}</h1><p className="mt-1 text-sm text-slate-500">{ru?'Выберите до 3 объектов.':'3 tagacha uy tanlang.'}</p></div><Link href="/listings" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">{ru?'Добавить объект':'Uy qo‘shish'}</Link></div>
      {loading?<div className="mt-6 rounded-2xl bg-white p-10 text-center text-slate-500">{ru?'Загрузка...':'Yuklanmoqda...'}</div>:!items.length?<div className="mt-6 rounded-3xl border border-dashed bg-white p-12 text-center"><div className="text-5xl">⚖️</div><h2 className="mt-3 text-xl font-black">{ru?'Пока нет объектов для сравнения':'Hali solishtirish uchun uy yo‘q'}</h2><p className="mt-1 text-sm text-slate-500">{ru?'На странице объявления нажмите «Сравнить».':'E’lon sahifasida “Solishtirish” tugmasini bosing.'}</p><Link href="/listings" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-black text-white">{ru?'Смотреть объявления':'E’lonlarni ko‘rish'}</Link></div>:
      <div className="mt-6 overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"><table className="min-w-[760px] w-full text-left text-sm"><thead><tr className="border-b"><th className="w-40 p-4"></th>{items.map(x=><th key={x.id} className="min-w-[230px] p-4 align-top"><div className="overflow-hidden rounded-2xl bg-slate-100">{x.primary_image_url?<img src={x.primary_image_url} alt="" className="h-36 w-full object-cover"/>:<div className="h-36"/>}</div><p className="mt-3 line-clamp-2 font-black">{ru?(x.title_ru||x.title):x.title}</p><button onClick={()=>remove(x.id)} className="mt-2 text-xs font-bold text-red-600">{ru?'Убрать':'Olib tashlash'}</button></th>)}</tr></thead><tbody>{rows.map(([label,fn])=><tr key={label} className="border-b last:border-0"><th className="sticky left-0 bg-white p-4 font-bold text-slate-500">{label}</th>{items.map(x=><td key={x.id} className="p-4 font-black">{fn(x)}</td>)}</tr>)}</tbody></table></div>}
      <p className="mt-4 text-xs text-slate-400">* {ru?'Ориентир: 21,5% годовых, 20 лет, 20% первоначального взноса.':'Taxminiy: 21,5% yillik, 20 yil, 20% boshlang‘ich badal.'}</p>
    </div>
  </main>
}
