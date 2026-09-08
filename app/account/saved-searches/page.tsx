'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Search = { id: string; name: string; query: Record<string, unknown>; is_active: boolean; notify_push: boolean; notify_email: boolean; created_at: string }

const label = (key: string, value: unknown) => {
  const map: Record<string,string> = { sale:'Sotuv', rent:'Ijara', daily:'Kunlik', apartment:'Kvartira', house:'Xususiy uy', land:'Yer', commercial:'Tijorat', new_building:'Yangi bino', owner:'Egadan', verified:'Tasdiqlangan', mortgage:'Ipotekaga mumkin' }
  if (typeof value === 'boolean') return value ? (map[key] || key) : ''
  return map[String(value)] || String(value)
}

function summary(query: Record<string, unknown>) {
  const parts: string[] = []
  for (const key of ['tab','region','district','type','rooms','min','max','currency']) {
    const value = query[key]
    if (value !== undefined && value !== null && value !== '') parts.push(key === 'rooms' ? `${value}+ xona` : key === 'min' ? `dan ${value}` : key === 'max' ? `gacha ${value}` : label(key, value))
  }
  for (const key of ['owner','verified','mortgage']) if (query[key] === true) parts.push(label(key, true))
  return parts.length ? parts.join(' · ') : 'Barcha e’lonlar'
}

export default function SavedSearchesPage() {
  const router = useRouter()
  const [items,setItems] = useState<Search[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const supabase = createClient(); const { data:{user} } = await supabase.auth.getUser()
      if (!user) { router.replace('/register?redirect=/account/saved-searches'); return }
      const { data,error } = await supabase.from('saved_searches').select('id,name,query,is_active,notify_push,notify_email,created_at').eq('user_id',user.id).order('created_at',{ascending:false})
      if (error) throw error
      setItems((data||[]) as Search[])
    } catch (e) { setError(e instanceof Error ? e.message : 'Saqlangan qidiruvlarni yuklab bo‘lmadi.') }
    finally { setLoading(false) }
  }

  useEffect(()=>{ void load() },[])

  async function toggle(item: Search) {
    setBusy(item.id)
    try {
      const response = await fetch('/api/searches',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,isActive:!item.is_active})})
      if (!response.ok) throw new Error('Holatni o‘zgartirib bo‘lmadi.')
      setItems(v=>v.map(x=>x.id===item.id?{...x,is_active:!x.is_active}:x))
    } catch(e) { setError(e instanceof Error?e.message:'Xatolik') } finally { setBusy('') }
  }

  async function remove(item: Search) {
    if (!window.confirm(`“${item.name}” qidiruvini o‘chirasizmi?`)) return
    setBusy(item.id)
    try {
      const response = await fetch(`/api/searches?id=${encodeURIComponent(item.id)}`,{method:'DELETE'})
      if (!response.ok) throw new Error('Qidiruvni o‘chirib bo‘lmadi.')
      setItems(v=>v.filter(x=>x.id!==item.id))
    } catch(e) { setError(e instanceof Error?e.message:'Xatolik') } finally { setBusy('') }
  }

  const openSearch = (item: Search) => {
    const q = new URLSearchParams()
    Object.entries(item.query || {}).forEach(([key,value])=>{ if (value !== undefined && value !== null && value !== '') q.set(key,String(value)) })
    router.push(`/listings?${q.toString()}`)
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10"><div className="mx-auto max-w-4xl"><header className="flex items-center justify-between"><Link href="/account" className="text-sm font-extrabold text-emerald-700">← Shaxsiy kabinet</Link><Link href="/listings" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">E’lonlarni ko‘rish</Link></header>
    <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">Prohouse</p><h1 className="mt-2 text-3xl font-black">Saqlangan qidiruvlar</h1><p className="mt-2 text-sm leading-6 text-slate-500">Muhim filtrlarni saqlang. Keyin bir bosishda aynan shu qidiruvni qayta ochishingiz mumkin.</p></div>
      {error && <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
      {loading ? <div className="mt-8 rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">Yuklanmoqda...</div> : !items.length ? <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center"><div className="text-4xl">⌕</div><h2 className="mt-3 font-black">Hali saqlangan qidiruv yo‘q</h2><p className="mt-1 text-sm text-slate-500">E’lonlar sahifasida filtrlarni tanlab, qidiruvni saqlash imkoniyati shu modul bilan bog‘lanadi.</p><Link href="/listings" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Qidirishni boshlash</Link></div> : <div className="mt-6 space-y-3">{items.map(item=><article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-slate-900">{item.name}</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${item.is_active?'bg-emerald-100 text-emerald-700':'bg-slate-200 text-slate-500'}`}>{item.is_active?'Faol':'O‘chiq'}</span></div><p className="mt-2 text-sm text-slate-500">{summary(item.query)}</p><div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500"><span className="rounded-full bg-white px-2.5 py-1">Push: {item.notify_push?'ha':'yo‘q'}</span><span className="rounded-full bg-white px-2.5 py-1">Email: {item.notify_email?'ha':'yo‘q'}</span></div></div><div className="flex shrink-0 flex-wrap gap-2"><button onClick={()=>openSearch(item)} className="rounded-xl bg-white px-3.5 py-2.5 text-sm font-extrabold text-emerald-700 ring-1 ring-slate-200 hover:ring-emerald-300">Ochish</button><button disabled={busy===item.id} onClick={()=>void toggle(item)} className="rounded-xl bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 disabled:opacity-50">{item.is_active?'Pauza':'Yoqish'}</button><button disabled={busy===item.id} onClick={()=>void remove(item)} className="rounded-xl bg-white px-3.5 py-2.5 text-sm font-bold text-red-600 ring-1 ring-slate-200 disabled:opacity-50">O‘chirish</button></div></div></article>)}</div>}
    </section></div></main>
}
