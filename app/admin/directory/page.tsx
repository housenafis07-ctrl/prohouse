'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Result = {
  kind: 'listing' | 'profile'
  id: string
  code: string | null
  name: string | null
  phone: string | null
  accountType: string | null
  title?: string | null
  status?: string | null
  ownerId?: string | null
  listingCount?: number
}

type Counts = { clients: number; listings: number }

const labelStatus = (status: string | null | undefined) => ({
  active: 'Faol', moderation: 'Moderatsiyada', draft: 'Qoralama', rejected: 'Rad etilgan',
})[status || ''] || status || '—'

export default function AdminDirectoryPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [counts, setCounts] = useState<Counts>({ clients: 0, listings: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const load = async (query = q) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/directory?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Yuklashda xatolik')
      setResults(data.results || [])
      setCounts(data.counts || { clients: 0, listings: 0 })
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Xatolik')
    } finally { setLoading(false) }
  }

  useEffect(() => { load('') }, [])

  const action = async (url: string, key: string, confirmText: string) => {
    if (!window.confirm(confirmText)) return
    setBusy(key); setMessage('')
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Amal bajarilmadi')
      setMessage(data.message || 'Bajarildi')
      await load()
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Xatolik') }
    finally { setBusy('') }
  }

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5"><div><Link href="/admin" className="text-sm font-bold text-emerald-600">← Admin</Link><h1 className="mt-1 text-3xl font-black">Mijozlar va e’lonlar</h1><p className="mt-1 text-sm text-slate-500">Hamkor, jismoniy shaxs va e’lonlarni ID, ism, telefon yoki nom bo‘yicha toping.</p></div></div></header>
    <div className="mx-auto max-w-6xl px-4 py-7">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Jami mijozlar</p><p className="mt-2 text-4xl font-black">{counts.clients}</p><p className="mt-1 text-xs text-slate-400">Jismoniy shaxs + hamkor profillar</p></div>
        <div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Jami e’lonlar</p><p className="mt-2 text-4xl font-black">{counts.listings}</p><p className="mt-1 text-xs text-slate-400">Barcha statuslar</p></div>
      </div>
      <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') load()}} placeholder="Hamkor ID, e’lon ID, ism, telefon, kompaniya, nom..." className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"/><button onClick={()=>load()} className="rounded-2xl bg-slate-900 px-6 py-3 font-bold text-white">Qidirish</button></div>
        {message && <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{message}</div>}
      </div>
      <div className="mt-6 space-y-4">
        {loading ? <div className="rounded-3xl bg-white p-8 text-center text-slate-500">Qidirilmoqda...</div> : results.length === 0 ? <div className="rounded-3xl bg-white p-8 text-center text-slate-500">Natija topilmadi.</div> : results.map(item => item.kind === 'listing' ? <div key={`l-${item.id}`} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">E’lon ID: {item.code || item.id}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{labelStatus(item.status)}</span></div><h2 className="mt-3 text-xl font-black">{item.title || 'Nomsiz e’lon'}</h2><p className="mt-1 text-sm text-slate-500">Sotuvchi: {item.name || '—'} · {item.phone || 'Telefon yo‘q'}</p><p className="mt-1 text-xs text-slate-400">Hamkor/mijoz ID: {item.ownerId || '—'}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy===`draft-${item.id}`} onClick={()=>action(`/api/admin/directory/listing/${item.id}/draft`,`draft-${item.id}`,'E’lonni qoralamaga qaytarilsinmi?')} className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-bold text-amber-700">Qoralamaga</button><button disabled={busy===`delete-${item.id}`} onClick={()=>action(`/api/admin/directory/listing/${item.id}/delete`,`delete-${item.id}`,'DIQQAT: e’lon butunlay o‘chiriladi. Davom etilsinmi?')} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">O‘chirish</button></div></div></div> : <div key={`p-${item.id}`} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">Hamkor ID: {item.code || item.id}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{item.accountType || 'account'}</span></div><h2 className="mt-3 text-xl font-black">{item.name || 'Nomsiz mijoz'}</h2><p className="mt-1 text-sm text-slate-500">{item.phone || 'Telefon yo‘q'} · {item.listingCount || 0} ta e’lon</p><p className="mt-1 text-xs text-slate-400">Auth ID: {item.id}</p></div><button disabled={busy===`user-${item.id}`} onClick={()=>action(`/api/admin/directory/profile/${item.id}/delete`,`user-${item.id}`,'DIQQAT: mijoz akkaunti va unga tegishli ma’lumotlar o‘chiriladi. Davom etilsinmi?')} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">Mijozni butunlay o‘chirish</button></div></div>)}
      </div>
    </div>
  </main>
}
