'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Status = 'all' | 'draft' | 'moderation' | 'active' | 'sold' | 'rented'
type Listing = {
  id: string
  listing_code: string
  title: string
  listing_type: string
  property_type: string
  status: string
  price: number
  currency: string
  city: string
  district: string | null
  area_m2: number | null
  rooms: number | null
  is_verified: boolean
  is_trusted_seller: boolean
  created_at: string
  updated_at: string
  published_at: string | null
  moderation_note: string | null
  sold_or_rented_at: string | null
  taxonomy_code: string | null
  listing_images?: { image_url: string; sort_order: number | null }[]
  // Supabase returns a relation as an array, even when the relation is logically one-to-one.
  partner_listing_taxonomy?: { name_uz: string; name_ru: string | null }[] | null
}

const statusMeta: Record<Exclude<Status, 'all'>, { label: string; description: string }> = {
  draft: { label: 'Qoralama', description: 'Tayyorlanayotgan e’lonlar' },
  moderation: { label: 'Moderatsiyada', description: 'Tekshiruv kutilmoqda' },
  active: { label: 'Faol', description: 'Saytda ko‘rinayotgan e’lonlar' },
  sold: { label: 'Sotilgan', description: 'Sotuv yakunlangan' },
  rented: { label: 'Ijaraga berilgan', description: 'Ijara yakunlangan' },
}

const money = (value: number, currency: string) => `${new Intl.NumberFormat('ru-RU').format(Number(value))} ${currency === 'USD' ? '$' : 'so‘m'}`
const typeLabel: Record<string, string> = { apartment: 'Kvartira', house: 'Xususiy uy', land: 'Yer uchastkasi', commercial: 'Tijorat mulki', new_building: 'Yangi bino' }

export default function MyListingsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Listing[]>([])
  const [status, setStatus] = useState<Status>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { router.replace('/register'); return }
    const { data: profile } = await db.from('profiles').select('account_type').eq('id', user.id).maybeSingle()
    if (profile?.account_type !== 'partner') { setError('Bu bo‘lim faqat hamkor akkauntlari uchun ochiq.'); setLoading(false); return }
    const { data, error: queryError } = await db.from('listings').select('id,listing_code,title,listing_type,property_type,status,price,currency,city,district,area_m2,rooms,is_verified,is_trusted_seller,created_at,updated_at,published_at,moderation_note,sold_or_rented_at,taxonomy_code,listing_images(image_url,sort_order),partner_listing_taxonomy(name_uz,name_ru)').eq('owner_id', user.id).order('updated_at', { ascending: false })
    if (queryError) setError(queryError.message); else setItems((data ?? []) as Listing[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [router])

  const counts = useMemo(() => {
    const result: Record<Status, number> = { all: items.length, draft: 0, moderation: 0, active: 0, sold: 0, rented: 0 }
    items.forEach(item => { if (item.status in result) result[item.status as Status] += 1 })
    return result
  }, [items])

  const visible = useMemo(() => status === 'all' ? items : items.filter(item => item.status === status), [items, status])

  const changeStatus = async (id: string, nextStatus: 'sold' | 'rented') => {
    setActionId(id); setError('')
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { router.replace('/register'); return }
    const { error: updateError } = await db.from('listings').update({ status: nextStatus, sold_or_rented_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.id).eq('status', 'active')
    if (updateError) setError(updateError.message); else await load()
    setActionId('')
  }

  const reopen = async (id: string) => {
    setActionId(id); setError('')
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { router.replace('/register'); return }
    const { error: updateError } = await db.from('listings').update({ status: 'moderation', moderation_note: null, moderation_updated_at: null, sold_or_rented_at: null, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.id).in('status', ['draft', 'sold', 'rented'])
    if (updateError) setError(updateError.message); else await load()
    setActionId('')
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4"><Link href="/account" className="text-sm font-extrabold text-emerald-700">← Shaxsiy kabinet</Link><Link href="/listings/new" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">+ E’lon joylashtirish</Link></div></header>
    <div className="mx-auto max-w-6xl px-4 py-7 sm:py-10">
      <div><p className="text-sm font-bold text-emerald-600">Prohouse hamkor kabineti</p><h1 className="mt-1 text-3xl font-black">Mening e’lonlarim</h1><p className="mt-2 text-sm text-slate-500">Joylashtirgan e’lonlaringizni boshqaring, holatini kuzating va tahrirlang.</p></div>

      <div className="mt-7 grid gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-6">{(['all','draft','moderation','active','sold','rented'] as Status[]).map(key => <button key={key} onClick={() => setStatus(key)} className={`min-w-[125px] rounded-xl px-3 py-3 text-left transition ${status === key ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'}`}><span className="block text-sm font-extrabold">{key === 'all' ? 'Barchasi' : statusMeta[key].label}</span><span className="mt-1 block text-xs text-slate-400">{counts[key]}</span></button>)}</div>

      {error && <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
      {loading ? <div className="mt-5 rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">E’lonlar yuklanmoqda...</div> : visible.length === 0 ? <div className="mt-5 rounded-3xl bg-white p-10 text-center shadow-sm"><div className="text-4xl">⌂</div><h2 className="mt-3 text-xl font-black">{status === 'all' ? 'Hali e’lonlaringiz yo‘q' : statusMeta[status].label + ' e’lonlar yo‘q'}</h2><p className="mt-2 text-sm text-slate-500">{status === 'all' ? 'Birinchi e’loningizni joylashtirishdan boshlang.' : statusMeta[status].description}</p><Link href="/listings/new" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">E’lon joylashtirish</Link></div> : <div className="mt-5 space-y-4">{visible.map(item => {
        const image = item.listing_images?.slice().sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.image_url
        const statusInfo = statusMeta[item.status as Exclude<Status,'all'>]
        const taxonomyName = item.partner_listing_taxonomy?.[0]?.name_uz
        return <article key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="grid md:grid-cols-[220px_1fr]">
          <div className="h-52 bg-slate-100 md:h-full">{image ? <img src={image} alt={item.title} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Rasm yo‘q</div>}</div>
          <div className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : item.status === 'moderation' ? 'bg-amber-50 text-amber-700' : item.status === 'draft' ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-700'}`}>{statusInfo?.label || item.status}</span>{item.is_trusted_seller && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">✓ Ishonchli hamkor</span>}</div><h2 className="mt-3 text-xl font-black">{item.title}</h2><p className="mt-1 text-xs font-semibold text-slate-400">{item.listing_code}{taxonomyName ? ` · ${taxonomyName}` : ''}</p></div><p className="text-xl font-black text-emerald-600">{money(item.price, item.currency)}</p></div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500"><span>{typeLabel[item.property_type] || item.property_type}</span>{item.area_m2 != null && <span>{item.area_m2} m²</span>}{item.rooms != null && <span>{item.rooms} xona</span>}<span>{item.city}{item.district ? `, ${item.district}` : ''}</span></div>
          {item.moderation_note && <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800"><b>Moderatsiya izohi:</b> {item.moderation_note}</div>}
          <div className="mt-5 flex flex-wrap gap-2"><Link href={`/listings/${item.id}`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-emerald-300">Ko‘rish</Link>{(item.status === 'draft' || item.status === 'moderation' || item.status === 'active') && <Link href={`/account/listings/${item.id}/edit`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-emerald-300">Tahrirlash</Link>}{item.status === 'active' && <button disabled={actionId === item.id} onClick={() => changeStatus(item.id, item.listing_type === 'rent' || item.listing_type === 'daily' ? 'rented' : 'sold')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{actionId === item.id ? 'Saqlanmoqda...' : item.listing_type === 'rent' || item.listing_type === 'daily' ? 'Ijaraga berildi' : 'Sotildi'}</button>}{(item.status === 'sold' || item.status === 'rented') && <button disabled={actionId === item.id} onClick={() => reopen(item.id)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 disabled:opacity-50">Qayta faollashtirish</button>}</div>
          <p className="mt-4 text-xs text-slate-400">Yangilangan: {new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.updated_at))}</p>
          </div></div></article>
      })}</div>}
    </div>
  </main>
}
