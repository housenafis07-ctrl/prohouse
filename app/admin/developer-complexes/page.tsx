'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'
import ComplexPublicMap from '../../new-buildings/ComplexPublicMap'

type Complex = {
  id: string; developer_id: string | null; name: string; slug: string; city: string; district: string | null
  address: string | null; description: string | null; status: string; completion_year: number | null
  is_verified: boolean; moderation_status: string; moderation_note: string | null; moderated_at: string | null
  latitude: number | null; longitude: number | null; map_data: { features?: any[] } | null
  created_at: string
  developer: { id: string; developer_name: string; verification_status: string } | null
  buildings: Array<{ id: string; name: string; building_no: string | null; floors: number | null; units_total: number | null }>
}
const labels: Record<string, [string,string]> = {
  pending: ['Tekshiruv kutilmoqda','Ожидает проверки'],
  approved: ['Tasdiqlangan','Одобрено'],
  rejected: ['Rad etilgan','Отклонено'],
  revision_requested: ['Tahrirga qaytarilgan','На доработке'],
}

export default function ComplexModerationPage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, rr: string) => ru ? rr : uz
  const [items,setItems] = useState<Complex[]>([])
  const [filter,setFilter] = useState('pending')
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState<string | null>(null)
  const [error,setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/admin/developer-complexes',{cache:'no-store'})
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'LOAD_FAILED')
      setItems(data.complexes || [])
    } catch(e) { setError(e instanceof Error ? e.message : t('Yuklashda xatolik','Ошибка загрузки')) }
    finally { setLoading(false) }
  }
  useEffect(()=>{void load()},[])

  const counts = useMemo(()=>({
    pending:items.filter(x=>x.moderation_status==='pending').length,
    approved:items.filter(x=>x.moderation_status==='approved').length,
    rejected:items.filter(x=>x.moderation_status==='rejected').length,
    revision_requested:items.filter(x=>x.moderation_status==='revision_requested').length,
  }),[items])
  const filtered = useMemo(()=>filter==='all'?items:items.filter(x=>x.moderation_status===filter),[items,filter])

  async function review(item: Complex, status: 'approved'|'rejected'|'revision_requested') {
    const prompt = status==='approved' ? '' : window.prompt(t(status==='rejected'?'Rad etish sababini kiriting:':'Qayta ishlash uchun izoh kiriting:',status==='rejected'?'Укажите причину отказа:':'Укажите, что нужно исправить:'))?.trim() || ''
    if(status!=='approved'&&!prompt) return
    setBusy(item.id); setError('')
    try {
      const response=await fetch('/api/admin/developer-complexes',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({complexId:item.id,status,note:prompt})})
      const data=await response.json()
      if(!response.ok) throw new Error(data.error||'REVIEW_FAILED')
      setItems(current=>current.map(row=>row.id===item.id?{...row,moderation_status:status,moderation_note:prompt||null,is_verified:status==='approved',moderated_at:data.reviewedAt}:row))
    } catch(e) { setError(e instanceof Error?e.message:t('Saqlashda xatolik','Ошибка сохранения')) }
    finally { setBusy(null) }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/admin" className="font-black text-emerald-700">← {t('Admin panel','Панель администратора')}</Link><button onClick={()=>void load()} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">{t('Yangilash','Обновить')}</button></div>
    <header className="mt-5 rounded-3xl bg-slate-900 p-7 text-white"><p className="text-sm font-black text-emerald-300">ROYALHOUSE · DEVELOPER REVIEW</p><h1 className="mt-2 text-3xl font-black">{t('Turar-joy majmualari moderatsiyasi','Модерация жилых комплексов')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{t('Majmua ma’lumotlari, xarita konturlari, korpuslar va infratuzilmani tekshiring. Tasdiqlangan majmua ommaviy sahifada ko‘rinadi.','Проверяйте данные, контуры карты, корпуса и инфраструктуру. Одобренный комплекс становится виден на публичной странице.')}</p></header>
    <div className="mt-5 grid gap-3 sm:grid-cols-4">{(['pending','approved','rejected','revision_requested'] as const).map(s=><button key={s} onClick={()=>setFilter(s)} className={`rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ${filter===s?'ring-2 ring-emerald-500':'ring-slate-200'}`}><p className="text-xs font-bold text-slate-500">{labels[s][ru?1:0]}</p><p className="mt-1 text-2xl font-black">{counts[s]}</p></button>)}</div>
    <div className="mt-4 flex flex-wrap gap-2">{(['pending','approved','rejected','revision_requested','all'] as const).map(s=><button key={s} onClick={()=>setFilter(s)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter===s?'bg-slate-900 text-white':'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{s==='all'?t('Barchasi','Все'):labels[s][ru?1:0]}</button>)}</div>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading?<div className="mt-6 rounded-2xl bg-white p-10 text-center">{t('Yuklanmoqda...','Загрузка...')}</div>:filtered.length===0?<div className="mt-6 rounded-2xl bg-white p-10 text-center text-slate-500">{t('Bu bo‘limda majmualar yo‘q.','В этом разделе комплексов нет.')}</div>:<div className="mt-5 space-y-4">{filtered.map(item=><article key={item.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">{labels[item.moderation_status]?.[ru?1:0]||item.moderation_status}</span><h2 className="mt-3 text-xl font-black">{item.name}</h2><p className="mt-1 text-sm text-slate-500">{item.developer?.developer_name||'Developer topilmadi'} · {item.city}{item.district?`, ${item.district}`:''}</p></div><p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString(ru?'ru-RU':'uz-UZ')}</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{t('Manzil','Адрес')}</p><p className="mt-1 font-bold">{item.address||'—'}</p><p className="mt-1 text-sm text-slate-500">{item.latitude!=null&&item.longitude!=null?`${item.latitude}, ${item.longitude}`:t('Xarita nuqtasi kiritilmagan','Точка на карте не указана')}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{t('Loyiha holati / topshirish','Статус / сдача')}</p><p className="mt-1 font-bold">{item.status} · {item.completion_year||'—'}</p><p className="mt-1 text-sm text-slate-500">{item.buildings.length} {t('ta korpus','корпусов')} · {item.map_data?.features?.length||0} {t('ta xarita obyekt','объектов карты')}</p></div><div className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><p className="text-xs text-slate-400">{t('Loyiha haqida','О проекте')}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.description||'—'}</p></div></div>
      {item.map_data?.features?.length>0&&<details className="mt-3 rounded-xl border p-3"><summary className="cursor-pointer text-sm font-black text-emerald-700">{t('Xarita konturi va 3D ko‘rinishni tekshirish','Проверить контуры карты и 3D')}</summary><div className="mt-3"><ComplexPublicMap mapData={item.map_data} latitude={item.latitude} longitude={item.longitude} buildings={item.buildings.map(building=>({id:building.id,name:building.name,units_total:building.units_total}))}/></div></details>}
      {item.buildings.length>0&&<div className="mt-3 rounded-xl border p-3"><p className="text-sm font-black">{t('Korpuslar','Корпуса')}</p><div className="mt-2 flex flex-wrap gap-2">{item.buildings.map(b=><span key={b.id} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">{b.name}{b.building_no?` · ${b.building_no}`:''} · {b.floors||'—'} {t('qavat','этажей')} · {b.units_total||0} {t('xonadon','квартир')}</span>)}</div></div>}
      {item.moderation_note&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><b>{t('Admin izohi:','Комментарий администратора:')}</b> {item.moderation_note}</p>}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{item.moderation_status!=='approved'&&<button disabled={busy===item.id} onClick={()=>void review(item,'approved')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{t('Tasdiqlash va nashr qilish','Одобрить и опубликовать')}</button>}{item.moderation_status!=='revision_requested'&&<button disabled={busy===item.id} onClick={()=>void review(item,'revision_requested')} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">{t('Tahrirga qaytarish','Вернуть на доработку')}</button>}{item.moderation_status!=='rejected'&&<button disabled={busy===item.id} onClick={()=>void review(item,'rejected')} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-black text-red-700 disabled:opacity-50">{t('Rad etish','Отклонить')}</button>}</div>
    </article>)}</div>}
  </div></main>
}
