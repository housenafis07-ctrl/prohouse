'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ListingLocationPicker from '@/app/components/ListingLocationPicker'
import ListingImageManager from '@/app/components/ListingImageManager'

type Listing = {
  id: string
  listing_code: string
  title: string
  description: string | null
  listing_type: string
  property_type: string
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
  taxonomy_code: string | null
}
type Taxonomy = { code: string; name_uz: string; section_code: string; parent_code: string | null; listing_type: string | null; property_type: string | null; is_mortgage_filter: boolean; is_new_construction_filter: boolean; sort_order: number }

const sectionLabels: Record<string, string> = { sale: 'Sotib olish', rent: 'Ijara', new_building: 'Yangi uylar' }
const typeLabels: Record<string, string> = { apartment: 'Kvartira', house: 'Xususiy uy', land: 'Yer uchastkasi', commercial: 'Tijorat mulki', new_building: 'Yangi bino' }

export default function EditPartnerListingPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [listing, setListing] = useState<Listing | null>(null)
  const [taxonomy, setTaxonomy] = useState<Taxonomy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ taxonomy_code: '', title: '', description: '', price: '', currency: 'UZS', area_m2: '', rooms: '', floor: '', floors_total: '', city: 'Toshkent', district: '', neighborhood: '', address: '', latitude: null as number | null, longitude: null as number | null })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const [{ data, error: listingError }, { data: taxonomyData, error: taxonomyError }] = await Promise.all([
        db.from('listings').select('id,listing_code,title,description,listing_type,property_type,status,price,currency,area_m2,rooms,floor,floors_total,city,district,neighborhood,address,latitude,longitude,taxonomy_code').eq('id', params.id).eq('owner_id', user.id).maybeSingle(),
        db.from('partner_listing_taxonomy').select('code,name_uz,section_code,parent_code,listing_type,property_type,is_mortgage_filter,is_new_construction_filter,sort_order').eq('is_active', true).eq('allows_partner_listing', true).order('sort_order'),
      ])
      if (!mounted) return
      if (listingError) setError(listingError.message)
      if (taxonomyError) setError(taxonomyError.message)
      if (!data) { setError('E’lon topilmadi yoki sizga tegishli emas.'); setLoading(false); return }
      const row = data as Listing
      if (row.status === 'sold' || row.status === 'rented') { setError('Sotilgan yoki ijaraga berilgan e’lonni bu yerda tahrirlab bo‘lmaydi.'); setListing(row); setLoading(false); return }
      setListing(row); setTaxonomy((taxonomyData ?? []) as Taxonomy[]); setForm({ taxonomy_code: row.taxonomy_code || '', title: row.title, description: row.description || '', price: String(row.price), currency: row.currency, area_m2: row.area_m2 == null ? '' : String(row.area_m2), rooms: row.rooms == null ? '' : String(row.rooms), floor: row.floor == null ? '' : String(row.floor), floors_total: row.floors_total == null ? '' : String(row.floors_total), city: row.city || 'Toshkent', district: row.district || '', neighborhood: row.neighborhood || '', address: row.address || '', latitude: row.latitude, longitude: row.longitude })
      setLoading(false)
    }
    void load(); return () => { mounted = false }
  }, [params.id, router])

  const update = (key: keyof typeof form, value: string | number | null) => setForm(v => ({ ...v, [key]: value }))
  const selected = taxonomy.find(item => item.code === form.taxonomy_code) ?? null
  const groups = Object.entries(sectionLabels).map(([section, label]) => ({ section, label, items: taxonomy.filter(item => item.section_code === section) })).filter(group => group.items.length)

  async function save(e: FormEvent) {
    e.preventDefault(); if (!listing) return
    setError(''); setSuccess('')
    if (!form.taxonomy_code || !selected) return setError('E’lon bo‘limi va bo‘linmasini tanlang.')
    if (!form.title.trim()) return setError('E’lon sarlavhasini kiriting.')
    const price = Number(form.price.replace(/\s/g, ''))
    if (!Number.isFinite(price) || price <= 0) return setError('To‘g‘ri narx kiriting.')
    if (form.latitude == null || form.longitude == null) return setError('Xaritadan mulk joylashuvini belgilang.')
    setSaving(true)
    try {
      const db = createClient(); const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/register'); return }
      const nextStatus = listing.status === 'draft' ? 'draft' : 'moderation'
      const { error: updateError } = await db.from('listings').update({ taxonomy_code: selected.code, title: form.title.trim(), description: form.description.trim() || null, listing_type: selected.listing_type || listing.listing_type, property_type: selected.property_type || listing.property_type, status: nextStatus, price, currency: form.currency, area_m2: form.area_m2 ? Number(form.area_m2) : null, rooms: form.rooms ? Number(form.rooms) : null, floor: form.floor ? Number(form.floor) : null, floors_total: form.floors_total ? Number(form.floors_total) : null, city: form.city.trim() || 'Toshkent', district: form.district.trim() || null, neighborhood: form.neighborhood.trim() || null, address: form.address.trim() || null, latitude: form.latitude, longitude: form.longitude, moderation_note: null, moderation_updated_at: null, updated_at: new Date().toISOString() }).eq('id', listing.id).eq('owner_id', user.id)
      if (updateError) throw updateError
      setListing(v => v ? { ...v, ...form, price, status: nextStatus, description: form.description, listing_type: selected.listing_type || v.listing_type, property_type: selected.property_type || v.property_type, area_m2: form.area_m2 ? Number(form.area_m2) : null, rooms: form.rooms ? Number(form.rooms) : null, floor: form.floor ? Number(form.floor) : null, floors_total: form.floors_total ? Number(form.floors_total) : null, latitude: form.latitude, longitude: form.longitude, taxonomy_code: selected.code } : v)
      setSuccess(nextStatus === 'moderation' ? 'O‘zgarishlar saqlandi va e’lon qayta moderatsiyaga yuborildi.' : 'Qoralama saqlandi.')
    } catch (e) { setError(e instanceof Error ? e.message : 'E’lonni saqlashda xatolik yuz berdi.') } finally { setSaving(false) }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-8 text-center text-slate-500">Yuklanmoqda...</main>
  if (!listing) return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center"><h1 className="text-xl font-black">{error || 'E’lon topilmadi'}</h1><Link href="/account/listings" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Mening e’lonlarim</Link></div></main>

  return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Link href="/account/listings" className="text-sm font-extrabold text-emerald-700">← Mening e’lonlarim</Link><Link href={`/listings/${listing.id}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Ko‘rish</Link></div></header>
    <div className="mx-auto max-w-5xl px-4 py-7 sm:py-10"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">{listing.listing_code}</p><h1 className="mt-1 text-3xl font-black">E’lonni tahrirlash</h1><p className="mt-2 text-sm text-slate-500">Faol e’londagi o‘zgarishlar qayta moderatsiyadan o‘tadi.</p></div>
      {error && <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}{success && <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
      <form onSubmit={save} className="mt-5 space-y-6"><section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-black">Bo‘lim va bo‘linma</h2><p className="mt-1 text-sm text-slate-500">E’lon qaysi xizmat va bo‘linmaga tegishli ekanini belgilang.</p><div className="mt-5 space-y-4">{groups.map(group => <div key={group.section}><h3 className="font-extrabold">{group.label}</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{group.items.map(item => <button type="button" key={item.code} onClick={() => update('taxonomy_code', item.code)} className={`rounded-2xl border p-4 text-left ${form.taxonomy_code === item.code ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200'}`}><span className="block font-extrabold">{item.name_uz}</span><span className="mt-1 block text-xs text-slate-500">{typeLabels[item.property_type || ''] || item.property_type || ''}{item.is_mortgage_filter ? ' · Ipotekaga mumkin' : ''}{item.is_new_construction_filter ? ' · Yangi qurilish' : ''}</span></button>)}</div></div>)}</div>{selected && <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm"><b>{selected.name_uz}</b> · {typeLabels[selected.property_type || ''] || selected.property_type || ''}</div>}</section>

        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-black">Asosiy ma’lumotlar</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-bold">Sarlavha *</span><input value={form.title} onChange={e => update('title', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" required /></label><label><span className="text-sm font-bold">Narx *</span><input inputMode="numeric" value={form.price} onChange={e => update('price', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" required /></label><label><span className="text-sm font-bold">Valyuta</span><select value={form.currency} onChange={e => update('currency', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="UZS">So‘m</option><option value="USD">USD</option></select></label><label><span className="text-sm font-bold">Maydon (m²)</span><input value={form.area_m2} onChange={e => update('area_m2', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label><label><span className="text-sm font-bold">Xonalar</span><input value={form.rooms} onChange={e => update('rooms', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label><div><span className="text-sm font-bold">Qavat / jami</span><div className="mt-2 flex gap-2"><input value={form.floor} onChange={e => update('floor', e.target.value)} placeholder="5" className="w-1/2 rounded-xl border border-slate-200 px-4 py-3"/><input value={form.floors_total} onChange={e => update('floors_total', e.target.value)} placeholder="9" className="w-1/2 rounded-xl border border-slate-200 px-4 py-3"/></div></div><label className="sm:col-span-2"><span className="text-sm font-bold">Tavsif</span><textarea rows={6} value={form.description} onChange={e => update('description', e.target.value)} className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3" /></label></div></section>

        <ListingImageManager listingId={listing.id} />

        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-black">Joylashuv</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-bold">Shahar</span><input value={form.city} onChange={e => update('city', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label><label><span className="text-sm font-bold">Tuman</span><input value={form.district} onChange={e => update('district', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label><label><span className="text-sm font-bold">Mahalla</span><input value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label><label><span className="text-sm font-bold">Manzil</span><input value={form.address} onChange={e => update('address', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label></div><div className="mt-5"><ListingLocationPicker latitude={form.latitude} longitude={form.longitude} onChange={(latitude, longitude) => setForm(v => ({ ...v, latitude, longitude }))}/></div></section>

        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5"><p className="font-extrabold">{listing.status === 'draft' ? 'Qoralama' : 'Moderatsiya'}</p><p className="mt-1 text-sm text-slate-600">{listing.status === 'draft' ? 'Saqlashda e’lon qoralama holatida qoladi.' : 'Faol e’lonni o‘zgartirsangiz, u tekshiruv uchun qayta moderatsiyaga yuboriladi.'}</p></section>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/account/listings" className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-center font-bold text-slate-700">Bekor qilish</Link><button disabled={saving} className="rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white disabled:opacity-50">{saving ? 'Saqlanmoqda...' : listing.status === 'draft' ? 'Qoralamani saqlash' : 'Saqlash va moderatsiyaga yuborish'}</button></div>
      </form>
    </div></main>
}
