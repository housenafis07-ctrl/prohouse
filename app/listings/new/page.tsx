'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ListingLocationPicker from '@/app/components/ListingLocationPicker'

type Profile = { full_name: string | null; phone: string | null; account_type: 'individual' | 'partner' | null; partner_type: string | null; trusted_profile: boolean | null }
type Taxonomy = { code: string; name_uz: string; name_ru: string | null; section_code: string; parent_code: string | null; listing_type: string | null; property_type: string | null; is_mortgage_filter: boolean; is_new_construction_filter: boolean; sort_order: number }
type ImageItem = { file: File; preview: string }

const sectionLabels: Record<string, string> = { sale: 'Sotib olish', rent: 'Ijara', new_building: 'Yangi uylar' }
const typeLabels: Record<string, string> = { apartment: 'Kvartira', house: 'Xususiy uy', land: 'Yer uchastkasi', commercial: 'Tijorat mulki', new_building: 'Yangi bino' }

export default function NewListingPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [taxonomy, setTaxonomy] = useState<Taxonomy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [images, setImages] = useState<ImageItem[]>([])
  const [mainImage, setMainImage] = useState(0)
  const [location, setLocation] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null })
  const [form, setForm] = useState({ taxonomy_code: '', listing_type: 'sale', property_type: 'apartment', title: '', description: '', price: '', currency: 'UZS', area_m2: '', rooms: '', floor: '', floors_total: '', city: 'Toshkent', district: '', neighborhood: '', address: '' })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const [{ data: profileData, error: profileError }, { data: taxonomyData, error: taxonomyError }] = await Promise.all([
        supabase.from('profiles').select('full_name,phone,account_type,partner_type,trusted_profile').eq('id', user.id).maybeSingle(),
        supabase.from('partner_listing_taxonomy').select('code,name_uz,name_ru,section_code,parent_code,listing_type,property_type,is_mortgage_filter,is_new_construction_filter,sort_order').eq('is_active', true).eq('allows_partner_listing', true).order('sort_order'),
      ])
      if (!mounted) return
      if (profileError) setError(profileError.message)
      if (taxonomyError) setError(taxonomyError.message)
      const nextProfile = profileData ?? { full_name: null, phone: user.phone ?? null, account_type: 'individual' as const, partner_type: null, trusted_profile: false }
      setProfile(nextProfile)
      setTaxonomy((taxonomyData ?? []) as Taxonomy[])
      setLoading(false)
    }
    void load(); return () => { mounted = false }
  }, [router])

  useEffect(() => () => images.forEach(item => URL.revokeObjectURL(item.preview)), [images])
  const update = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value }))
  const trusted = Boolean(profile?.trusted_profile)
  const sellerLabel = useMemo(() => profile?.account_type === 'partner' ? ({ self_employed: 'O‘zini o‘zi band qilgan', sole_proprietor: 'YaTT', llc: 'MChJ' }[profile.partner_type ?? ''] ?? 'Hamkor') : 'Jismoniy shaxs', [profile])
  const categories = taxonomy.filter(item => item.parent_code && sectionLabels[item.section_code])
  const grouped = Object.entries(sectionLabels).map(([section, label]) => ({ section, label, items: categories.filter(item => item.section_code === section) })).filter(group => group.items.length)
  const selectedTaxonomy = taxonomy.find(item => item.code === form.taxonomy_code) ?? null

  const selectTaxonomy = (item: Taxonomy) => setForm(v => ({ ...v, taxonomy_code: item.code, listing_type: item.listing_type || v.listing_type, property_type: item.property_type || v.property_type }))
  const addImages = (event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (!files.length) return; setError(''); if (images.length + files.length > 10) return setError('Maksimal 10 ta rasm yuklash mumkin.'); const invalid = files.find(file => !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024); if (invalid) return setError('Faqat rasm fayllari, har biri 10 MB gacha bo‘lishi mumkin.'); setImages(current => [...current, ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))]) }
  const removeImage = (index: number) => { URL.revokeObjectURL(images[index].preview); setImages(current => current.filter((_, i) => i !== index)); setMainImage(current => current === index ? 0 : current > index ? current - 1 : current) }

  async function submit(e: FormEvent) {
    e.preventDefault(); if (!profile) return
    setError(''); setSuccess('')
    if (profile.account_type !== 'partner') return setError('E’lon joylashtirish hozircha faqat hamkor akkauntlari uchun ochiq.')
    if (!form.taxonomy_code || !selectedTaxonomy) return setError('Avval e’lon joylashtiriladigan bo‘limni tanlang.')
    const price = Number(form.price.replace(/\s/g, ''))
    if (!form.title.trim()) return setError('E’lon sarlavhasini kiriting.')
    if (!Number.isFinite(price) || price <= 0) return setError('To‘g‘ri narx kiriting.')
    if (location.latitude == null || location.longitude == null) return setError('Xaritadan mulk joylashuvini belgilang.')
    setSaving(true)
    try {
      const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.replace('/register'); return }
      const { data: listing, error: listingError } = await supabase.from('listings').insert({ owner_id: user.id, taxonomy_code: selectedTaxonomy.code, title: form.title.trim(), description: form.description.trim() || null, listing_type: selectedTaxonomy.listing_type || form.listing_type, property_type: selectedTaxonomy.property_type || form.property_type, status: 'active', price, currency: form.currency, area_m2: form.area_m2 ? Number(form.area_m2) : null, rooms: form.rooms ? Number(form.rooms) : null, floor: form.floor ? Number(form.floor) : null, floors_total: form.floors_total ? Number(form.floors_total) : null, city: form.city.trim() || 'Toshkent', district: form.district.trim() || null, neighborhood: form.neighborhood.trim() || null, address: form.address.trim() || null, latitude: location.latitude, longitude: location.longitude, seller_type: 'realtor', seller_name: profile.full_name?.trim() || null, seller_phone: profile.phone || null, is_verified: false, is_trusted_seller: trusted, published_at: new Date().toISOString() }).select('id,listing_code').single()
      if (listingError) throw listingError
      if (images.length) {
        const ordered = [images[mainImage], ...images.filter((_, i) => i !== mainImage)]; const uploaded: { image_url: string; sort_order: number }[] = []
        for (let i = 0; i < ordered.length; i++) { const file = ordered[i].file; const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${user.id}/${listing.id}/${crypto.randomUUID()}-${safeName}`; const { error: uploadError } = await supabase.storage.from('listing-images').upload(path, file, { cacheControl: '31536000', upsert: false }); if (uploadError) throw uploadError; const { data: publicUrl } = supabase.storage.from('listing-images').getPublicUrl(path); uploaded.push({ image_url: publicUrl.publicUrl, sort_order: i }) }
        const { error: imageError } = await supabase.from('listing_images').insert(uploaded.map(item => ({ listing_id: listing.id, image_url: item.image_url, sort_order: item.sort_order }))); if (imageError) throw imageError
      }
      setSuccess(`E’lon joylashtirildi. ID: ${listing.listing_code}`); setTimeout(() => router.push(`/listings/${listing.id}`), 700)
    } catch (e) { setError(e instanceof Error ? e.message : 'E’lonni saqlashda xatolik yuz berdi.') } finally { setSaving(false) }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 text-center shadow-sm">Yuklanmoqda...</div></main>
  if (!profile) return null

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10"><div className="mx-auto max-w-5xl"><header className="mb-5 flex items-center justify-between gap-4"><Link href="/account" className="text-sm font-extrabold text-emerald-700">← Shaxsiy kabinet</Link><Link href="/listings" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">E’lonlarni ko‘rish</Link></header>
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="bg-slate-900 px-6 py-7 text-white sm:px-8"><p className="text-sm font-semibold text-slate-300">Prohouse hamkor kabineti</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">E’lon joylashtirish</h1><p className="mt-2 text-sm text-slate-300">Avval e’loningiz qaysi bo‘lim va bo‘linmaga tegishli ekanini tanlang.</p></div>
      {profile.account_type !== 'partner' ? <div className="p-8"><div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">Bu sahifa hamkorlar uchun mo‘ljallangan. Ro‘yxatdan o‘tishda akkaunt turini “Hamkor” qilib tanlang.</div></div> : <form onSubmit={submit} className="space-y-8 p-6 sm:p-8">
        <div><div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-900">1. E’lon bo‘limi va bo‘linmasi</h2><p className="mt-1 text-sm text-slate-500">Saytdagi bo‘limlardan faqat hamkor e’lonlari uchun ruxsat berilgan bo‘linmalar ko‘rsatiladi.</p></div>{selectedTaxonomy && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Tanlandi</span>}</div>
          <div className="mt-5 space-y-5">{grouped.map(group => <div key={group.section} className="rounded-2xl border border-slate-200 p-4"><h3 className="font-extrabold text-slate-900">{group.label}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.items.map(item => <button type="button" key={item.code} onClick={() => selectTaxonomy(item)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${form.taxonomy_code === item.code ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-200'}`}><span className="block font-extrabold text-slate-900">{item.name_uz}</span><span className="mt-1 block text-xs text-slate-500">{item.listing_type === 'daily' ? 'Kunlik ijara' : item.listing_type === 'rent' ? 'Ijara' : item.is_new_construction_filter ? 'Yangi qurilish' : item.is_mortgage_filter ? 'Ipotekaga mumkin' : typeLabels[item.property_type || ''] || ''}</span></button>)}</div></div>)}</div>
          {selectedTaxonomy && <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm"><b>{selectedTaxonomy.name_uz}</b><span className="text-slate-500"> · {typeLabels[selectedTaxonomy.property_type || ''] || ''}</span>{selectedTaxonomy.is_mortgage_filter && <span className="ml-2 rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-700">Ipotekaga mumkin</span>}{selectedTaxonomy.is_new_construction_filter && <span className="ml-2 rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-700">Yangi qurilish</span>}</div>}
        </div>

        <div><h2 className="text-lg font-extrabold text-slate-900">2. Asosiy ma’lumotlar</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-sm font-bold text-slate-700">E’lon sarlavhasi *</span><input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Masalan: 3 xonali shinam kvartira" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" required /></label><label className="block"><span className="text-sm font-bold text-slate-700">Narx *</span><input inputMode="numeric" value={form.price} onChange={e => update('price', e.target.value)} placeholder="850000000" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" required /></label><label className="block sm:col-span-2"><span className="text-sm font-bold text-slate-700">Tavsif</span><textarea value={form.description} onChange={e => update('description', e.target.value)} rows={5} placeholder="Uy, ta’mir, jihozlar va boshqa muhim ma’lumotlar..." className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3" /></label></div></div>

        <div><h2 className="text-lg font-extrabold text-slate-900">3. Narx va o‘lcham</h2><div className="mt-4 grid gap-4 sm:grid-cols-3"><label><span className="text-sm font-bold">Valyuta</span><select value={form.currency} onChange={e => update('currency', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="UZS">So‘m</option><option value="USD">USD</option></select></label><label><span className="text-sm font-bold">Maydon (m²)</span><input value={form.area_m2} onChange={e => update('area_m2', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label><label><span className="text-sm font-bold">Xonalar</span><input value={form.rooms} onChange={e => update('rooms', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label><label><span className="text-sm font-bold">Qavat / jami</span><div className="mt-2 flex gap-2"><input value={form.floor} onChange={e => update('floor', e.target.value)} placeholder="5" className="w-1/2 rounded-xl border border-slate-200 px-4 py-3"/><input value={form.floors_total} onChange={e => update('floors_total', e.target.value)} placeholder="9" className="w-1/2 rounded-xl border border-slate-200 px-4 py-3"/></div></label></div></div>

        <div><h2 className="text-lg font-extrabold text-slate-900">4. Manzil va xarita</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-bold">Shahar</span><input value={form.city} onChange={e => update('city', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label><label><span className="text-sm font-bold">Tuman</span><input value={form.district} onChange={e => update('district', e.target.value)} placeholder="Yunusobod" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label><label><span className="text-sm font-bold">Mahalla</span><input value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label><label><span className="text-sm font-bold">Manzil</span><input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Ko‘cha, uy raqami" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label></div><div className="mt-5"><ListingLocationPicker latitude={location.latitude} longitude={location.longitude} onChange={(latitude, longitude) => setLocation({ latitude, longitude })}/></div></div>

        <div><div className="flex items-end justify-between"><div><h2 className="text-lg font-extrabold text-slate-900">5. Rasmlar</h2><p className="mt-1 text-sm text-slate-500">10 tagacha rasm. Birinchisini asosiy rasm qilib belgilang.</p></div><span className="text-sm font-bold text-slate-500">{images.length}/10</span></div><label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center hover:border-emerald-300"><span className="text-3xl">📷</span><span className="mt-2 font-extrabold">Rasmlarni tanlang</span><span className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP • har biri 10 MB gacha</span><input type="file" accept="image/*" multiple onChange={addImages} className="hidden" disabled={images.length >= 10}/></label>{images.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{images.map((item,index)=><div key={item.preview} className={`relative overflow-hidden rounded-2xl border-2 ${mainImage===index?'border-emerald-500':'border-slate-100'}`}><img src={item.preview} alt={`Rasm ${index+1}`} className="h-36 w-full object-cover"/><div className="p-2"><button type="button" onClick={()=>setMainImage(index)} className="mr-1 rounded-lg bg-emerald-50 px-2 py-2 text-[11px] font-bold text-emerald-700">{mainImage===index?'★ Asosiy':'Asosiy'}</button><button type="button" onClick={()=>removeImage(index)} className="rounded-lg bg-red-50 px-2 py-2 text-[11px] font-bold text-red-600">O‘chirish</button></div></div>)}</div>}</div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600"><b className="text-slate-900">E’lon egasi:</b> {profile.full_name || 'F.I.O. kiritilmagan'} · {profile.phone || 'Telefon yo‘q'}<br/><span className="text-slate-500">Tanlangan bo‘lim: {selectedTaxonomy?.name_uz || 'tanlanmagan'}</span></div>
        {error && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}{success && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{success}</div>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/account" className="rounded-2xl border border-slate-200 px-6 py-4 text-center font-bold text-slate-700">Bekor qilish</Link><button disabled={saving || !form.taxonomy_code} className="rounded-2xl bg-emerald-600 px-8 py-4 font-extrabold text-white disabled:opacity-50">{saving ? 'Joylashtirilmoqda...' : 'E’lonni joylashtirish'}</button></div>
      </form>}
    </section></div></main>
}
