'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Offer = { id:string; version:number; title:string; content:string; is_active:boolean; created_at:string }

export default function OfferAdminPage() {
  const [password, setPassword] = useState('')
  const [offers, setOffers] = useState<Offer[]>([])
  const [title, setTitle] = useState('Ommaviy oferta')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)

  async function load(secret = password) {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/offer', { headers: { Authorization: `Bearer ${secret}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kirish rad etildi')
      setOffers(data.offers || [])
      const active = (data.offers || []).find((item:Offer) => item.is_active)
      if (active) {
        setTitle(active.title)
        setContent(active.content)
      }
      setLoggedIn(true)
      sessionStorage.setItem('prohouse_admin_password', secret)
    } catch (e) {
      setLoggedIn(false)
      sessionStorage.removeItem('prohouse_admin_password')
      setMessage(e instanceof Error ? e.message : 'Xatolik')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('prohouse_admin_password')
    if (saved) {
      setPassword(saved)
      load(saved)
    }
  }, [])

  async function login(e:React.FormEvent) {
    e.preventDefault()
    await load(password)
  }

  async function save() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/offer', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${password}` },
        body:JSON.stringify({ title, content })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Saqlashda xatolik')
      setOffers(prev => [data.offer, ...prev.map(o => ({ ...o, is_active:false }))])
      setMessage(`Oferta ${data.offer.version}-versiya sifatida saqlandi.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Saqlashda xatolik')
    } finally {
      setLoading(false)
    }
  }

  if (!loggedIn) return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm sm:p-8"><Link href="/" className="text-sm font-semibold text-emerald-700">← Prohouse</Link><h1 className="mt-6 text-2xl font-extrabold text-slate-900">Admin panel — Ommaviy oferta</h1><p className="mt-2 text-sm text-slate-500">Admin parolini kiriting.</p><form onSubmit={login} className="mt-6 space-y-4"><input autoFocus type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Admin paroli" className="w-full rounded-xl border border-slate-200 px-4 py-3"/><button disabled={loading || !password} className="w-full rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50">{loading ? 'Tekshirilmoqda...' : 'Kirish'}</button></form>{message && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}<p className="mt-5 text-xs text-slate-400">Admin paroli serverdagi <code>PROHOUSE_ADMIN_PASSWORD</code> o‘zgaruvchisidan olinadi.</p></div></main>

  const active = offers.find(o=>o.is_active)
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-4xl"><div className="flex items-center justify-between gap-4"><div><Link href="/" className="text-sm font-semibold text-emerald-700">← Prohouse</Link><h1 className="mt-3 text-3xl font-extrabold text-slate-900">Ommaviy oferta</h1><p className="mt-1 text-sm text-slate-500">Foydalanuvchilarga ko‘rsatiladigan oferta matnini boshqaring.</p></div><button onClick={()=>{sessionStorage.removeItem('prohouse_admin_password');setPassword('');setLoggedIn(false)}} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Chiqish</button></div><section className="mt-7 rounded-3xl bg-white p-6 shadow-sm"><div className="grid gap-5"><div><label className="mb-2 block text-sm font-semibold">Sarlavha</label><input value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div><label className="mb-2 block text-sm font-semibold">Oferta matni</label><textarea value={content} onChange={e=>setContent(e.target.value)} rows={24} className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-mono text-sm leading-6" placeholder="Ommaviy oferta shartlarini shu yerga kiriting..."/></div><div className="flex items-center justify-between gap-4"><div className="text-sm text-slate-500">{active ? `Amaldagi versiya: ${active.version}` : 'Amaldagi oferta yo‘q'}</div><button onClick={save} disabled={loading || !content.trim()} className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white disabled:opacity-50">{loading ? 'Saqlanmoqda...' : 'Saqlash'}</button></div>{message && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}</div></section><section className="mt-6 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">Versiyalar tarixi</h2><div className="mt-4 divide-y divide-slate-100">{offers.map(o=><div key={o.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><span className="font-semibold">Versiya {o.version}</span>{o.is_active && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Amaldagi</span>}</div><span className="text-slate-400">{new Date(o.created_at).toLocaleString('uz-UZ')}</span></div>)}</div></section></div></main>
}
