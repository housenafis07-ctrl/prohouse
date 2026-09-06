'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ListingLocationPicker from '@/app/components/ListingLocationPicker'

type Profile = { full_name: string | null; phone: string | null; account_type: 'individual' | 'partner' | null; partner_type: string | null; trusted_profile: boolean | null }
const propertyTypes = [['apartment', 'Kvartira'], ['house', 'Xususiy uy'], ['new_building', 'Yangi bino'], ['land', 'Yer uchastkasi'], ['commercial', 'Tijorat mulki']] as const

type ImageItem = { file: File; preview: string }

export default function NewListingPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [images, setImages] = useState<ImageItem[]>([])
  const [mainImage, setMainImage] = useState(0)
  const [location, setLocation] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null })
  const [form, setForm] = useState({ listing_type: 'sale', property_type: 'apartment', title: '', description: '', price: '', currency: 'UZS', area_m2: '', rooms: '', floor: '', floors_total: '', city: 'Toshkent', district: '', neighborhood: '', address: '' })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const { data, error: profileError } = await supabase.from('profiles').select('full_name,phone,account_type,partner_type,trusted_profile').eq('id', user.id).maybeSingle()
      if (!mounted) return
      if (profileError) setError(profileError.message)
      setProfile(data ?? { full_name: null, phone: user.phone ?? null, account_type: 'individual', partner_type: null, trusted_profile: false })
      setLoading(false)
    }
    void load()
    return () => { mounted = false }
  }, [router])

  useEffect(() => () => images.forEach(item => URL.revokeObjectURL(item.preview)), [images])
  const update = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value }))
  const trusted = Boolean(profile?.trusted_profile)
  const sellerLabel = useMemo(() => profile?.account_type === 'partner' ? ({ self_employed: 'O‘zini o‘zi band qilgan', sole_proprietor: 'YaTT', llc: 'MChJ' }[profile.partner_type ?? ''] ?? 'Hamkor') : 'Jismoniy shaxs', [profile])

  const addImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    setError('')
    if (images.length + files.length > 10) return setError('Maksimal 10 ta rasm yuklash mumkin.')
    const invalid = files.find(file => !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024)
    if (invalid) return setError('Faqat rasm fayllari, har biri 10 MB gacha bo‘lishi mumkin.')
    const next = files.map(file => ({ file, preview: URL.createObjectURL(file) }))
    setImages(current => [...current, ...next])
  }

  const removeImage = (index: number) => {
    URL.revokeObjectURL(images[index].preview)
    setImages(current => current.filter((_, i) => i !== index))
    setMainImage(current => current === index ? 0 : current > index ? current - 1 : current)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(''); setSuccess('')
    const price = Number(form.price.replace(/\s/g, ''))
    if (!form.title.trim()) return setError('E’lon sarlavhasini kiriting.')
    if (!Number.isFinite(price) || price <= 0) return setError('To‘g‘ri narx kiriting.')
    if (location.latitude == null || location.longitude == null) return setError('Xaritadan mulk joylashuvini belgilang.')
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const { data: listing, error: listingError } = await supabase.from('listings').insert({
        owner_id: user.id, title: form.title.trim(), description: form.description.trim() || null, listing_type: form.listing_type, property_type: form.property_type, status: 'active', price, currency: form.currency,
        area_m2: form.area_m2 ? Number(form.area_m2) : null, rooms: form.rooms ? Number(form.rooms) : null, floor: form.floor ? Number(form.floor) : null, floors_total: form.floors_total ? Number(form.floors_total) : null,
        city: form.city.trim() || 'Toshkent', district: form.district.trim() || null, neighborhood: form.neighborhood.trim() || null, address: form.address.trim() || null,
        latitude: location.latitude, longitude: location.longitude, seller_type: profile.account_type === 'partner' ? 'partner' : 'owner', seller_name: profile.full_name?.trim() || null, seller_phone: profile.phone || null,
        is_verified: false, is_trusted_seller: trusted, published_at: new Date().toISOString(),
      }).select('id,listing_code').single()
      if (listingError) throw listingError

      if (images.length) {
        const ordered = [images[mainImage], ...images.filter((_, i) => i !== mainImage)]
        const uploaded: { image_url: string; sort_order: number; path: string }[] = []
        for (let i = 0; i < ordered.length; i++) {
          const file = ordered[i].file
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const path = `${user.id}/${listing.id}/${crypto.randomUUID()}-${safeName}`
          const { error: uploadError } = await supabase.storage.from('listing-images').upload(path, file, { cacheControl: '31536000', upsert: false })
          if (uploadError) throw uploadError
          const { data: publicUrl } = supabase.storage.from('listing-images').getPublicUrl(path)
          uploaded.push({ image_url: publicUrl.publicUrl, sort_order: i, path })
        }
        const { error: imageError } = await supabase.from('listing_images').insert(uploaded.map(({ image_url, sort_order }) => ({ listing_id: listing.id, image_url, sort_order })))
        if (imageError) throw imageError
      }
      setSuccess(`E’lon joylashtirildi. ID: ${listing.listing_code}`)
      setTimeout(() => router.push(`/listings/${listing.id}`), 700)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'E’lonni saqlashda xatolik yuz berdi.')
    } finally { setSaving(false) }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 text-center shadow-sm">Yuklanmoqda...</div></main>

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex items-center justify-between gap-4"><Link href="/account" className="text-sm font-extrabold text-emerald-700">← Shaxsiy kabinet</Link><Link href="/listings" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">E’lonlarni ko‘rish</Link></header>
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-slate-900 px-6 py-7 text-white sm:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-slate-300">Prohouse</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">E’lon joylashtirish</h1><p className="mt-2 text-sm text-slate-300">Mulkingiz haqidagi ma’lumotlarni kiriting.</p></div><div className={`rounded-2xl px-4 py-3 text-center ${trusted ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-slate-200'}`}><div className="text-sm font-black">{trusted ? '✓ Ishonchli profil' : 'Oddiy profil'}</div><div className="mt-1 text-[11px]">{sellerLabel}</div></div></div></div>
        <form onSubmit={submit} className="space-y-8 p-6 sm:p-8">
          <div><h2 className="text-lg font-extrabold text-slate-900">1. Asosiy ma’lumotlar</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-sm font-bold text-slate-700">Amal turi</span><select value={form.listing_type} onChange={e => update('listing_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="sale">Sotuv</option><option value="rent">Ijara</option><option value="daily">Kunlik ijara</option></select></label>
            <label className="block"><span className="text-sm font-bold text-slate-700">Mulk turi</span><select value={form.property_type} onChange={e => update('property_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3">{propertyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block sm:col-span-2"><span className="text-sm font-bold text-slate-700">E’lon sarlavhasi *</span><input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Masalan: 3 xonali shinam kvartira" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" required /></label>
            <label className="block sm:col-span-2"><span className="text-sm font-bold text-slate-700">Tavsif</span><textarea value={form.description} onChange={e => update('description', e.target.value)} rows={5} placeholder="Uy, ta’mir, jihozlar va boshqa muhim ma’lumotlar..." className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>
          </div></div>

          <div><h2 className="text-lg font-extrabold text-slate-900">2. Narx va o‘lcham</h2><div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block sm:col-span-2"><span className="text-sm font-bold text-slate-700">Narx *</span><input inputMode="numeric" value={form.price} onChange={e => update('price', e.target.value)} placeholder="850000000" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" required /></label>
            <label className="block"><span className="text-sm font-bold text-slate-700">Valyuta</span><select value={form.currency} onChange={e => update('currency', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="UZS">So‘m</option><option value="USD">USD</option></select></label>
            <label className="block"><span className="text-sm font-bold text-slate-700">Maydon (m²)</span><input inputMode="decimal" value={form.area_m2} onChange={e => update('area_m2', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
            <label className="block"><span className="text-sm font-bold text-slate-700">Xonalar</span><input inputMode="numeric" value={form.rooms} onChange={e => update('rooms', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
            <label className="block"><span className="text-sm font-bold text-slate-700">Qavat / jami</span><div className="mt-2 flex gap-2"><input inputMode="numeric" placeholder="5" value={form.floor} onChange={e => update('floor', e.target.value)} className="w-1/2 rounded-xl border border-slate-200 px-4 py-3" /><input inputMode="numeric" placeholder="9" value={form.floors_total} onChange={e => update('floors_total', e.target.value)} className="w-1/2 rounded-xl border border-slate-200 px-4 py-3" /></div></label>
          </div></div>

          <div><h2 className="text-lg font-extrabold text-slate-900">3. Manzil va xarita</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-sm font-bold text-slate-700">Shahar</span><input value={form.city} onChange={e => update('city', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
            <label className="block"><span className="text-sm font-bold text-slate-700">Tuman</span><input value={form.district} onChange={e => update('district', e.target.value)} placeholder="Yunusobod" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
            <label className="block"><span className="text-sm font-bold text-slate-700">Mahalla</span><input value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
            <label className="block"><span className="text-sm font-bold text-slate-700">Manzil</span><input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Ko‘cha, uy raqami" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
          </div><div className="mt-5"><ListingLocationPicker latitude={location.latitude} longitude={location.longitude} onChange={(latitude, longitude) => setLocation({ latitude, longitude })} /></div></div>

          <div><div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-900">4. Rasmlar</h2><p className="mt-1 text-sm text-slate-500">10 tagacha rasm. Birinchisi asosiy rasm sifatida chiqadi; xohlasangiz boshqa rasmni asosiy qilib belgilang.</p></div><span className="shrink-0 text-sm font-bold text-slate-500">{images.length}/10</span></div>
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center hover:border-emerald-300 hover:bg-emerald-50"><span className="text-3xl">📷</span><span className="mt-2 font-extrabold text-slate-800">Rasmlarni tanlang</span><span className="mt-1 text-xs text-slate-500">Telefon yoki kompyuterdan • JPG, PNG, WEBP • har biri 10 MB gacha</span><input type="file" accept="image/*" multiple onChange={addImages} className="hidden" disabled={images.length >= 10} /></label>
            {images.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{images.map((item, index) => <div key={item.preview} className={`relative overflow-hidden rounded-2xl border-2 bg-white ${mainImage === index ? 'border-emerald-500' : 'border-slate-100'}`}><img src={item.preview} alt={`Rasm ${index + 1}`} className="h-36 w-full object-cover" /><div className="absolute left-2 top-2 rounded-full bg-slate-900/75 px-2 py-1 text-[10px] font-bold text-white">{mainImage === index ? '★ Asosiy' : `#${index + 1}`}</div><div className="flex gap-1 p-2"><button type="button" onClick={() => setMainImage(index)} className="flex-1 rounded-lg bg-emerald-50 px-2 py-2 text-[11px] font-bold text-emerald-700">Asosiy</button><button type="button" onClick={() => removeImage(index)} className="rounded-lg bg-red-50 px-2 py-2 text-[11px] font-bold text-red-600">O‘chirish</button></div></div>)}</div>}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600"><b className="text-slate-900">E’lon egasi:</b> {profile?.full_name || 'F.I.O. kiritilmagan'} · {profile?.phone || 'Telefon yo‘q'}<br /><span className="text-slate-500">E’lon ID raqami yuborilgandan so‘ng avtomatik yaratiladi (PH-XXXXXXXX).</span></div>
          {error && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}{success && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{success}</div>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/account" className="rounded-2xl border border-slate-200 px-6 py-4 text-center font-bold text-slate-700">Bekor qilish</Link><button disabled={saving} className="rounded-2xl bg-emerald-600 px-8 py-4 font-extrabold text-white shadow-sm disabled:opacity-50">{saving ? 'Joylashtirilmoqda...' : 'E’lonni joylashtirish'}</button></div>
        </form>
      </section>
    </div>
  </main>
}
