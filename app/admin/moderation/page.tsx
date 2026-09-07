'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type ImageItem = { image_url: string; sort_order: number | null }
type Taxonomy = { name_uz: string; name_ru: string | null; section_code: string; parent_code: string | null; is_mortgage_filter: boolean; is_new_construction_filter: boolean }
type Listing = {
  id: string; listing_code: string; title: string; title_ru: string | null; description: string | null
  listing_type: string; property_type: string; status: string; price: number; currency: string
  area_m2: number | null; rooms: number | null; floor: number | null; floors_total: number | null
  city: string; district: string | null; neighborhood: string | null; address: string | null
  latitude: number | null; longitude: number | null; seller_type: string; seller_name: string | null; seller_phone: string | null
  is_mortgage_available: boolean; is_trusted_seller: boolean; taxonomy_code: string | null
  moderation_note: string | null; created_at: string; updated_at: string
  partner_listing_taxonomy?: Taxonomy[] | null; listing_images?: ImageItem[] | null
}

const money = (value: number, currency: string) => `${new Intl.NumberFormat('ru-RU').format(Number(value))} ${currency === 'USD' ? '$' : 'so‘m'}`
const typeLabel: Record<string, string> = { apartment: 'Kvartira', house: 'Xususiy uy', land: 'Yer uchastkasi', commercial: 'Tijorat mulki', new_building: 'Yangi bino' }
const listingTypeLabel: Record<string, string> = { sale: 'Sotib olish', rent: 'Ijara', daily: 'Kunlik ijara', new_building: 'Yangi uylar' }

export default function ModerationPage() {
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [rejectId, setRejectId] = useState('')
  const [reason, setReason] = useState('')
  const [actionId, setActionId] = useState('')

  async function load(secret = password) {
    setLoading(true); setMessage('')
    try {
      const res = await fetch('/api/admin/listings', { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kirish rad etildi')
      setItems(data.listings || []); setLoggedIn(true); sessionStorage.setItem('prohouse_admin_password', secret)
    } catch (e) {
      setLoggedIn(false); sessionStorage.removeItem('prohouse_admin_password'); setMessage(e instanceof Error ? e.message : 'Xatolik')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('prohouse_admin_password')
    if (saved) { setPassword(saved); void load(saved) }
  }, [])

  async function login(e: React.FormEvent) { e.preventDefault(); await load(password) }

  async function moderate(id: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !reason.trim()) { setMessage('Rad etish sababini kiriting.'); return }
    setActionId(id); setMessage('')
    try {
      const res = await fetch('/api/admin/listings', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }, body: JSON.stringify({ id, action, reason }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Amal bajarilmadi')
      setItems(prev => prev.filter(item => item.id !== id)); setRejectId(''); setReason('')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Amal bajarilmadi') }
    finally { setActionId('') }
  }

  const stats = useMemo(() => ({ count: items.length }), [items])

  if (!loggedIn) return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm sm:p-8"><Link href="/" className="text-sm font-semibold text-emerald-700">← Prohouse</Link><h1 className="mt-6 text-3xl font-black text-slate-900">E’lonlar moderatsiyasi</h1><p className="mt-2 text-sm text-slate-500">Moderatsiya navbatini boshqarish uchun admin parolini kiriting.</p><form onSubmit={login} className="mt-6 space-y-4"><input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Admin paroli" className="w-full rounded-xl border border-slate-200 px-4 py-3"/><button disabled={loading || !password} className="w-full rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50">{loading ? 'Tekshirilmoqda...' : 'Kirish'}</button></form>{message && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}</div></main>

  return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4"><div className="flex items-center gap-4"><Link href="/admin/offer" className="text-sm font-extrabold text-emerald-700">← Admin</Link><span className="text-sm font-bold text-slate-400">Moderatsiya</span></div><div className="flex gap-2"><button onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">{loading ? 'Yangilanmoqda...' : 'Yangilash'}</button><button onClick={() => { sessionStorage.removeItem('prohouse_admin_password'); setPassword(''); setLoggedIn(false) }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">Chiqish</button></div></div></header>
    <div className="mx-auto max-w-7xl px-4 py-7 sm:py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-emerald-600">Prohouse admin panel</p><h1 className="mt-1 text-3xl font-black">E’lonlar moderatsiyasi</h1><p className="mt-2 text-sm text-slate-500">Hamkorlar yuborgan e’lonlarni tekshiring va saytga chiqarishdan oldin qaror qiling.</p></div><div className="rounded-2xl bg-white px-5 py-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Navbat</div><div className="mt-1 text-2xl font-black">{stats.count}</div></div></div>
      {message && <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
      {loading && !items.length ? <div className="mt-6 rounded-3xl bg-white p-12 text-center text-slate-500 shadow-sm">Moderatsiya navbati yuklanmoqda...</div> : !items.length ? <div className="mt-6 rounded-3xl bg-white p-12 text-center shadow-sm"><div className="text-4xl">✓</div><h2 className="mt-3 text-xl font-black">Moderatsiya navbati bo‘sh</h2><p className="mt-2 text-sm text-slate-500">Hozir tekshirilishi kerak bo‘lgan e’lon yo‘q.</p></div> : <div className="mt-6 space-y-5">{items.map(item => { const image = item.listing_images?.slice().sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.image_url; const taxonomy = item.partner_listing_taxonomy?.[0]; return <article key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="grid lg:grid-cols-[360px_1fr]"><div className="min-h-72 bg-slate-100">{image ? <img src={image} alt={item.title} className="h-full min-h-72 w-full object-cover"/> : <div className="flex h-full min-h-72 items-center justify-center text-sm text-slate-400">Rasm yo‘q</div>}</div><div className="p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Moderatsiyada</span>{item.is_trusted_seller && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">✓ Ishonchli hamkor</span>}</div><h2 className="mt-3 text-2xl font-black">{item.title}</h2><p className="mt-1 text-xs font-bold text-slate-400">{item.listing_code} · {listingTypeLabel[item.listing_type] || item.listing_type}</p></div><div className="text-right text-xl font-black text-emerald-600">{money(item.price, item.currency)}</div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-400">Mulk turi</div><div className="mt-1 font-bold">{typeLabel[item.property_type] || item.property_type}</div></div><div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-400">Maydon / xona</div><div className="mt-1 font-bold">{item.area_m2 ?? '—'} m² · {item.rooms ?? '—'} xona</div></div><div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-400">Joylashuv</div><div className="mt-1 font-bold">{item.city}{item.district ? `, ${item.district}` : ''}</div></div></div>
        <div className="mt-4 rounded-2xl border border-slate-200 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Bo‘lim / bo‘linma</div><div className="mt-1 font-black">{taxonomy?.name_uz || item.taxonomy_code || '—'}</div><div className="mt-1 text-sm text-slate-500">{taxonomy?.is_mortgage_filter ? 'Ipotekaga mumkin · ' : ''}{taxonomy?.is_new_construction_filter ? 'Yangi qurilish' : ''}</div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Hamkor</div><div className="mt-1 font-bold">{item.seller_name || '—'}</div><div className="text-sm text-slate-500">{item.seller_phone || '—'}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Manzil</div><div className="mt-1 font-bold">{item.address || item.neighborhood || '—'}</div><div className="text-sm text-slate-500">{item.latitude != null && item.longitude != null ? `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}` : 'Xarita belgilanmagan'}</div></div></div>
        {item.description && <div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Tavsif</div><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.description}</p></div>}
        {rejectId === item.id ? <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4"><label className="block text-sm font-bold text-red-900">Rad etish sababi *</label><textarea autoFocus rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Masalan: Rasm sifati talabga javob bermaydi yoki manzil ma’lumotini to‘ldiring." className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm"/><div className="mt-3 flex flex-wrap justify-end gap-2"><button onClick={() => { setRejectId(''); setReason('') }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">Bekor qilish</button><button disabled={actionId === item.id || !reason.trim()} onClick={() => void moderate(item.id, 'reject')} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{actionId === item.id ? 'Saqlanmoqda...' : 'Rad etish'}</button></div></div> : <div className="mt-5 flex flex-wrap gap-2"><Link href={`/listings/${item.id}`} target="_blank" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">E’lonni ko‘rish</Link><button disabled={actionId === item.id} onClick={() => void moderate(item.id, 'approve')} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{actionId === item.id ? 'Saqlanmoqda...' : '✓ Tasdiqlash'}</button><button disabled={actionId === item.id} onClick={() => setRejectId(item.id)} className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-700">Rad etish</button></div>}
      </div></div></article> })}</div>}
    </div>
  </main>
}
