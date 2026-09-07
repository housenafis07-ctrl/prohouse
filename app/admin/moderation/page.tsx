'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

type ImageItem = {
  id: string
  image_url: string
  sort_order: number | null
  storage_path: string | null
}

type Listing = {
  id: string
  listing_code: string
  title: string
  title_ru: string | null
  description: string | null
  listing_type: string
  property_type: string | null
  status: string
  price: number
  currency: string
  area_m2: number | null
  rooms: number | null
  floor: number | null
  floors_total: number | null
  city: string
  district: string | null
  neighborhood: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  seller_type: string
  seller_name: string | null
  seller_phone: string | null
  is_mortgage_available: boolean | null
  is_verified: boolean | null
  is_trusted_seller: boolean | null
  is_featured: boolean | null
  published_at: string | null
  created_at: string
  updated_at: string
  taxonomy_code: string | null
  moderation_note: string | null
  moderation_updated_at: string | null
  views_count: number | null
  accommodation_type: string | null
  max_guests: number | null
  sold_or_rented_at: string | null
  partner_listing_taxonomy?: {
    name_uz: string
    name_ru: string | null
    section_code: string | null
    parent_code: string | null
    is_mortgage_filter: boolean | null
    is_new_construction_filter: boolean | null
  }[] | null
  listing_images?: ImageItem[] | null
}

const money = (v: number, c: string) => `${new Intl.NumberFormat('ru-RU').format(Number(v))} ${c === 'USD' ? '$' : c === 'EUR' ? '€' : 'so‘m'}`
const typeLabel = (t: string) => ({ sale: 'Sotib olish', rent: 'Ijara', daily: 'Kunlik ijara', new_building: 'Yangi uylar', service: 'Xizmatlar', realtor: 'Rieltorlar' }[t] || t)
const propertyLabel = (t: string | null) => ({ apartment: 'Kvartira', house: 'Xususiy uy', land: 'Yer uchastkasi', commercial: 'Tijorat ko‘chmas mulki', new_building: 'Yangi bino' }[t || ''] || t || '—')
const sellerTypeLabel = (t: string) => ({ owner: 'Mulk egasi', realtor: 'Rieltor', agency: 'Agentlik', developer: 'Quruvchi', company: 'Kompaniya' }[t] || t)
const dateTime = (v: string | null | undefined) => v ? new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 break-words font-bold text-slate-900">{value ?? '—'}</div></div>
}

function Gallery({ listing }: { listing: Listing }) {
  const images = useMemo(() => (listing.listing_images || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [listing.listing_images])
  const [selected, setSelected] = useState(0)
  const [failed, setFailed] = useState<Record<string, boolean>>({})

  useEffect(() => setSelected(0), [listing.id])

  if (!images.length) return <div className="flex min-h-[420px] items-center justify-center rounded-3xl bg-slate-100 text-sm text-slate-400">E’lon uchun rasm yuklanmagan</div>

  const current = images[Math.min(selected, images.length - 1)]

  return <div>
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
      <div className="relative flex min-h-[420px] items-center justify-center sm:min-h-[520px]">
        {failed[current.id] ? <div className="p-8 text-center text-sm text-slate-500">Bu rasmni yuklab bo‘lmadi.<br /><span className="text-xs">Storage URL tekshirilishi kerak.</span></div> : <img src={current.image_url} alt={`${listing.title} — ${selected + 1}-rasm`} className="max-h-[620px] w-full object-contain" onError={() => setFailed(v => ({ ...v, [current.id]: true }))} />}
        <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white">{selected + 1} / {images.length}</div>
        {images.length > 1 && <>
          <button type="button" onClick={() => setSelected(v => v === 0 ? images.length - 1 : v - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-4 py-3 text-xl font-black shadow">‹</button>
          <button type="button" onClick={() => setSelected(v => v === images.length - 1 ? 0 : v + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-4 py-3 text-xl font-black shadow">›</button>
        </>}
      </div>
    </div>
    <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
      {images.map((image, index) => <button type="button" key={image.id} onClick={() => setSelected(index)} className={`overflow-hidden rounded-xl border-2 bg-slate-100 ${index === selected ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-transparent'}`}>
        {failed[image.id] ? <div className="flex aspect-square items-center justify-center text-[10px] text-slate-400">Xato</div> : <img src={image.image_url} alt={`${index + 1}-rasm`} className="aspect-square w-full object-cover" onError={() => setFailed(v => ({ ...v, [image.id]: true }))} />}
      </button>)}
    </div>
    <p className="mt-2 text-xs text-slate-500">Jami {images.length} ta rasm. Birinchi rasm hamkor tanlagan asosiy rasm.</p>
  </div>
}

export default function ModerationPage() {
  const supabase = createClient()
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reason, setReason] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [admin, setAdmin] = useState<{ email: string | null; role: string } | null>(null)

  async function load() {
    setLoading(true); setError('')
    const me = await fetch('/api/admin/me', { cache: 'no-store' })
    if (!me.ok) { location.href = '/admin/login'; return }
    setAdmin(await me.json())
    const r = await fetch('/api/admin/listings', { cache: 'no-store' })
    const d = await r.json()
    if (!r.ok) { setError(d.error || 'Xatolik'); setLoading(false); return }
    setItems((d.listings || []) as Listing[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function moderate(id: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !reason[id]?.trim()) { setError('Rad etish sababini kiriting.'); return }
    setBusy(id); setError('')
    const r = await fetch('/api/admin/listings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, reason: reason[id] || '' }) })
    const d = await r.json()
    if (!r.ok) setError(d.error || 'Amal bajarilmadi')
    else setItems(x => x.filter(i => i.id !== id))
    setBusy('')
  }

  async function logout() { await supabase.auth.signOut(); location.href = '/admin/login' }

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4"><div className="flex items-center gap-5"><Link href="/admin" className="font-black text-emerald-700">← Admin</Link><b>Moderatsiya</b></div><div className="flex items-center gap-3 text-sm"><span className="hidden text-slate-500 sm:block">{admin?.email}</span><button onClick={logout} className="rounded-xl border px-4 py-2 font-bold">Chiqish</button></div></div></header>
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-end justify-between"><div><p className="font-bold text-emerald-600">Prohouse Admin</p><h1 className="mt-1 text-3xl font-black">E’lonlar moderatsiyasi</h1><p className="mt-2 text-sm text-slate-500">Hamkor yuborgan e’lonning barcha ma’lumotlari va barcha rasmlarini tekshiring.</p></div><div className="rounded-2xl bg-white px-5 py-4 shadow-sm"><div className="text-xs text-slate-400">Navbat</div><b className="text-2xl">{items.length}</b></div></div>
      {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? <div className="mt-6 rounded-3xl bg-white p-12 text-center">Yuklanmoqda...</div> : !items.length ? <div className="mt-6 rounded-3xl bg-white p-12 text-center shadow-sm"><div className="text-4xl">✓</div><h2 className="mt-3 text-xl font-black">Moderatsiya navbati bo‘sh</h2></div> : <div className="mt-6 space-y-8">
        {items.map(i => <article key={i.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
              <div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Moderatsiyada</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{typeLabel(i.listing_type)}</span>{i.is_mortgage_available && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Ipotekaga mumkin</span>}{i.partner_listing_taxonomy?.[0]?.is_new_construction_filter && <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">Yangi qurilish</span>}</div><h2 className="mt-3 text-2xl font-black">{i.title}</h2><p className="mt-1 text-xs text-slate-400">{i.listing_code} · {i.partner_listing_taxonomy?.[0]?.name_uz || i.taxonomy_code || 'Bo‘lim tanlanmagan'}</p></div><div className="text-left lg:text-right"><b className="text-2xl text-emerald-600">{money(i.price, i.currency)}</b><p className="mt-1 text-xs text-slate-400">Yaratilgan: {dateTime(i.created_at)}</p></div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
              <Gallery listing={i} />
              <div className="space-y-6">
                <section><h3 className="mb-3 text-lg font-black">Asosiy ma’lumotlar</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Mulk turi" value={propertyLabel(i.property_type)} /><Field label="Narx" value={money(i.price, i.currency)} />{i.area_m2 != null && <Field label="Maydon" value={`${i.area_m2} m²`} />}{i.rooms != null && <Field label="Xonalar" value={i.rooms} />}{i.floor != null && <Field label="Qavat" value={`${i.floor}${i.floors_total != null ? ` / ${i.floors_total}` : ''}`} />}{i.accommodation_type && <Field label="Turar joy turi" value={i.accommodation_type} />}{i.max_guests != null && <Field label="Maks. mehmonlar" value={i.max_guests} />}</div></section>
                <section><h3 className="mb-3 text-lg font-black">Joylashuv</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Shahar" value={i.city} /><Field label="Tuman" value={i.district || '—'} /><Field label="Mahalla" value={i.neighborhood || '—'} /><Field label="Manzil" value={i.address || '—'} /><Field label="Koordinata" value={i.latitude != null && i.longitude != null ? `${i.latitude}, ${i.longitude}` : 'Belgilanmagan'} /></div></section>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 p-5"><h3 className="text-lg font-black">Hamkor / sotuvchi</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Turi" value={sellerTypeLabel(i.seller_type)} /><Field label="F.I.Sh. / nomi" value={i.seller_name || '—'} /><Field label="Telefon" value={i.seller_phone || '—'} /><Field label="Tasdiqlangan" value={i.is_verified ? 'Ha' : 'Yo‘q'} /><Field label="Ishonchli profil" value={i.is_trusted_seller ? 'Ha' : 'Yo‘q'} /><Field label="Ko‘rishlar" value={i.views_count ?? 0} /></div></section>
              <section className="rounded-2xl border border-slate-200 p-5"><h3 className="text-lg font-black">Tavsif</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{i.description || 'Tavsif kiritilmagan.'}</p></section>
            </div>

            <section className="mt-6 rounded-2xl border border-slate-200 p-5"><h3 className="text-lg font-black">Moderatsiya va tizim ma’lumotlari</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Status" value={i.status} /><Field label="Taxonomy" value={i.taxonomy_code || '—'} /><Field label="Oxirgi yangilanish" value={dateTime(i.updated_at)} /><Field label="Moderatsiya yangilanishi" value={dateTime(i.moderation_updated_at)} /></div></section>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"><h3 className="font-black">Qaror</h3><div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]"><input value={reason[i.id] || ''} onChange={e => setReason({ ...reason, [i.id]: e.target.value })} placeholder="Rad etish sababi (rad etishda majburiy)" className="rounded-xl border bg-white px-4 py-3 text-sm"/><button disabled={busy === i.id} onClick={() => void moderate(i.id, 'reject')} className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 font-bold text-red-700 disabled:opacity-50">Rad etish</button><button disabled={busy === i.id} onClick={() => void moderate(i.id, 'approve')} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">Tasdiqlash</button></div></div>
          </div>
        </article>)}
      </div>}
    </div>
  </main>
}
