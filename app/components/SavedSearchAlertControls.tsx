'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

const PREF='royalhouse-alerts-enabled'
const SNAP='royalhouse-alert-snapshot'

type Search={id:string;query:Record<string,unknown>;is_active:boolean}
type Snapshot={searches:Record<string,string[]>;prices:Record<string,number>}

async function notify(title:string,body:string){
  if(typeof window==='undefined' || !('Notification' in window) || Notification.permission!=='granted') return
  try {
    const registration = await navigator.serviceWorker?.getRegistration('/royalhouse-sw.js')
    if (registration) {
      await registration.showNotification(title, { body, icon: '/royalhouse-icon.svg', badge: '/royalhouse-icon.svg' })
      return
    }
  } catch {}
  try { new Notification(title,{body}) } catch {}
}

async function checkAlerts(seedOnly=false, ru=false){
  const db=createClient()
  const {data:{user}}=await db.auth.getUser()
  if(!user)return
  const {data:searches}=await db.from('saved_searches').select('id,query,is_active').eq('user_id',user.id)
  const {data:favorites}=await db.from('listing_favorites').select('listing_id,listing:listings(id,price,title,title_ru)').eq('user_id',user.id)
  const old:Snapshot=JSON.parse(localStorage.getItem(SNAP)||'{"searches":{},"prices":{}}')
  const next:Snapshot={searches:{...old.searches},prices:{...old.prices}}
  for(const s of (searches||[]) as Search[]){
    if(!s.is_active)continue
    const q=new URLSearchParams()
    Object.entries(s.query||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')q.set(k,String(v))})
    q.set('limit','8')
    const response=await fetch('/api/listings/search?'+q.toString(),{cache:'no-store'})
    if(!response.ok)continue
    const result=await response.json().catch(()=>({}))
    const ids=((result.data||[]) as {id:string}[]).map(x=>x.id)
    const previous=old.searches[s.id]||[]
    if(!seedOnly && previous.length){
      const fresh=ids.filter(id=>!previous.includes(id))
      if(fresh.length) void notify(ru?'Royalhouse — новые объявления':'Royalhouse — yangi uylar',ru?`${fresh.length} новых объявлений соответствуют сохранённому поиску.`:`${fresh.length} ta yangi e’lon saqlangan qidiruvingizga mos keldi.`)
    }
    next.searches[s.id]=ids
  }
  for(const f of (favorites||[]) as any[]){
    const listing=Array.isArray(f.listing)?f.listing[0]:f.listing
    if(!listing)continue
    const previous=old.prices[f.listing_id]
    if(!seedOnly && previous && Number(listing.price)<Number(previous)){
      void notify(ru?'Royalhouse — снижение цены':'Royalhouse — narx tushdi',`${String(ru?(listing.title_ru||listing.title):listing.title)}: ${ru?'цена снизилась.':'narx pasaydi.'}`)
    }
    next.prices[f.listing_id]=Number(listing.price)
  }
  localStorage.setItem(SNAP,JSON.stringify(next))
}

export default function SavedSearchAlertControls(){
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const [enabled,setEnabled]=useState(false)
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState('')

  useEffect(()=>{setEnabled(localStorage.getItem(PREF)==='1')},[])

  const enable=async()=>{
    setBusy(true);setStatus('')
    try{
      if(!('Notification' in window)){setStatus(ru?'Браузер не поддерживает уведомления.':'Brauzer bildirishnomalarni qo‘llab-quvvatlamaydi.');return}
      const permission=await Notification.requestPermission()
      if(permission!=='granted'){setStatus(ru?'Разрешение на уведомления не предоставлено.':'Bildirishnomalarga ruxsat berilmadi.');return}
      localStorage.setItem(PREF,'1');setEnabled(true)
      await navigator.serviceWorker?.register('/royalhouse-sw.js', { scope: '/' })
      await checkAlerts(true,ru)
      setStatus(ru?'Уведомления включены.':'Bildirishnomalar yoqildi.')
    }catch{setStatus(ru?'Не удалось включить уведомления.':'Bildirishnomalarni yoqib bo‘lmadi.')}finally{setBusy(false)}
  }

  useEffect(()=>{
    if(!enabled)return
    const run=()=>void checkAlerts(false,ru)
    const id=window.setInterval(run,10*60*1000)
    window.addEventListener('focus',run)
    return()=>{window.clearInterval(id);window.removeEventListener('focus',run)}
  },[enabled])

  return <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div><b className="text-sm">{enabled ? (ru?'🔔 Уведомления включены':'🔔 Bildirishnomalar yoqilgan') : (ru?'🔔 Уведомления поиска и цен':'🔔 Qidiruv va narx xabarnomalari')}</b><p className="mt-1 text-xs text-slate-600">{enabled ? (ru?'Новые подходящие объекты и снижение цены сохранённых объектов будут показываться в уведомлениях.':'Yangi mos uylar va saqlangan uy narxi tushganda brauzer xabari chiqadi.') : (ru?'Включите уведомления для сохранённых поисков и объектов.':'Saqlangan qidiruv va saqlangan uylar bo‘yicha brauzer xabarlarini yoqing.')}</p>{status&&<p className="mt-1 text-xs font-bold text-emerald-700">{status}</p>}</div>
    {!enabled&&<button type="button" disabled={busy} onClick={()=>void enable()} className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy?'...':ru?'Включить уведомления':'Xabarnomani yoqish'}</button>}
  </div>
}
