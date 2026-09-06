'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Profile = {
  full_name: string | null
  phone: string | null
  account_type: 'individual' | 'partner' | null
  partner_type: string | null
  trusted_profile: boolean | null
}

const propertyTypes = [
  ['apartment', 'Kvartira'],
  ['house', 'Xususiy uy'],
  ['new_building', 'Yangi bino'],
  ['land', 'Yer uchastkasi'],
  ['commercial', 'Tijorat mulki'],
] as const

export default function NewListingPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    listing_type: 'sale',
    property_type: 'apartment',
    title: '',
    description: '',
    price: '',
    currency: 'UZS',
    area_m2: '',
    rooms: '',
    floor: '',
    floors_total: '',
    city: 'Toshkent',
    district: '',
    neighborhood: '',
    address: '',
    seller_phone: '',
    image_urls: '',
  })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('full_name,phone,account_type,partner_type,trusted_profile')
        .eq('id', user.id)
        .maybeSingle()
      if (!mounted) return
      if (profileError) setError(profileError.message)
      const p: Profile = data ?? { full_name: null, phone: user.phone ?? null, account_type: 'individual', partner_type: null, trusted_profile: false }
      setProfile(p)
      setForm(v => ({ ...v, seller_phone: p.phone ?? '' }))
      setLoading(false)
    }
    void load()
    return () => { mounted = false }
  }, [router])

  const update = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value }))
  const trusted = Boolean(profile?.trusted_profile)
  const sellerLabel = useMemo(() => {
    if (!profile) return 'Foydalanuvchi'
    if (profile.account_type === 'partner') {
      if (profile.partner_type === 'self_employed') return 'O‘zini o‘zi band qilgan'
      if (profile.partner_type === 'sole_proprietor') return 'YaTT'
      if (profile.partner_type === 'llc') return 'MChJ'
      return 'Hamkor'
    }
    return 'Jismoniy shaxs'
  }, [profile])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError('')
    setSuccess('')
    const price = Number(form.price.replace(/\s/g, ''))
    if (!form.title.trim()) return setError('E’lon sarlavhasini kiriting.')
    if (!Number.isFinite(price) || price <= 0) return setError('To‘g‘ri narx kiriting.')
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }

      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .insert({
          owner_id: user.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          listing_type: form.listing_type,
          property_type: form.property_type,
          status: 'active',
          price,
          currency: form.currency,
          area_m2: form.area_m2 ? Number(form.area_m2) : null,
          rooms: form.rooms ? Number(form.rooms) : null,
          floor: form.floor ? Number(form.floor) : null,
          floors_total: form.floors_total ? Number(form.floors_total) : null,
          city: form.city.trim() || 'Toshkent',
          district: form.district.trim() || null,
          neighborhood: form.neighborhood.trim() || null,
          address: form.address.trim() || null,
          seller_type: profile.account_type === 'partner' ? 'partner' : 'owner',
          seller_name: profile.full_name?.trim() || null,
          seller_phone: profile.phone || null,
          is_verified: false,
          is_trusted_seller: trusted,
          published_at: new Date().toISOString(),
        })
        .select('id,listing_code')
        .single()
      if (listingError) throw listingError

      const urls = form.image_urls.split('\n').map(v => v.trim()).filter(Boolean).slice(0, 10)
      if (urls.length) {
        const { error: imageError } = await supabase.from('listing_images').insert(
          urls.map((image_url, index) => ({ listing_id: listing.id, image_url, sort_order: index }))
        )
        if (imageError) throw imageError
      }

      setSuccess(`E’lon joylashtirildi. ID: ${listing.listing_code}`)
      setTimeout(() => router.push(`/listings/${listing.id}`), 700)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'E’lonni saqlashda xatolik yuz berdi.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 text-center shadow-sm">Yuklanmoqda...</div></main>

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <Link href="/account" className="text-sm font-extrabold text-emerald-700">← Shaxsiy kabinet</Link>
          <Link href="/listings" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">E’lonlarni ko‘rish</Link>
        </header>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="bg-slate-900 px-6 py-7 text-white sm:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-slate-300">Prohouse</p>
                <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">E’lon joylashtirish</h1>
                <p className="mt-2 text-sm text-slate-300">Mulkingiz haqidagi ma’lumotlarni kiriting.</p>
              </div>
              <div className={`rounded-2xl px-4 py-3 text-center ${trusted ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-slate-200'}`}>
                <div className="text-sm font-black">{trusted ? '✓ Ishonchli profil' : 'Oddiy profil'}</div>
                <div className="mt-1 text-[11px]">{sellerLabel}</div>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-7 p-6 sm:p-8">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">1. Asosiy ma’lumotlar</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-bold text-slate-700">Amal turi</span><select value={form.listing_type} onChange={e => update('listing_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="sale">Sotuv</option><option value="rent">Ijara</option><option value="daily">Kunlik ijara</option></select></label>
                <label className="block"><span className="text-sm font-bold text-slate-700">Mulk turi</span><select value={form.property_type} onChange={e => update('property_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3">{propertyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="block sm:col-span-2"><span className="text-sm font-bold text-slate-700">E’lon sarlavhasi *</span><input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Masalan: 3 xonali shinam kvartira" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" required /></label>
                <label className="block sm:col-span-2"><span className="text-sm font-bold text-slate-700">Tavsif</span><textarea value={form.description} onChange={e => update('description', e.target.value)} rows={5} placeholder="Uy, ta’mir, jihozlar va boshqa muhim ma’lumotlar..." className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-slate-900">2. Narx va o‘lcham</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="block sm:col-span-2"><span className="text-sm font-bold text-slate-700">Narx *</span><input inputMode="numeric" value={form.price} onChange={e => update('price', e.target.value)} placeholder="850000000" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" required /></label>
                <label className="block"><span className="text-sm font-bold text-slate-700">Valyuta</span><select value={form.currency} onChange={e => update('currency', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="UZS">So‘m</option><option value="USD">USD</option></select></label>
                <label className="block"><span className="text-sm font-bold text-slate-700">Maydon (m²)</span><input inputMode="decimal" value={form.area_m2} onChange={e => update('area_m2', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                <label className="block"><span className="text-sm font-bold text-slate-700">Xonalar</span><input inputMode="numeric" value={form.rooms} onChange={e => update('rooms', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                <label className="block"><span className="text-sm font-bold text-slate-700">Qavat / jami</span><div className="mt-2 flex gap-2"><input inputMode="numeric" placeholder="5" value={form.floor} onChange={e => update('floor', e.target.value)} className="w-1/2 rounded-xl border border-slate-200 px-4 py-3" /><input inputMode="numeric" placeholder="9" value={form.floors_total} onChange={e => update('floors_total', e.target.value)} className="w-1/2 rounded-xl border border-slate-200 px-4 py-3" /></div></label>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-slate-900">3. Manzil</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-bold text-slate-700">Shahar</span><input value={form.city} onChange={e => update('city', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                <label className="block"><span className="text-sm font-bold text-slate-700">Tuman</span><input value={form.district} onChange={e => update('district', e.target.value)} placeholder="Yunusobod" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                <label className="block"><span className="text-sm font-bold text-slate-700">Mahalla</span><input value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                <label className="block"><span className="text-sm font-bold text-slate-700">Manzil</span><input value={form.address} onChange={e => update('address', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-slate-900">4. Rasmlar</h2>
              <p className="mt-1 text-sm text-slate-500">Hozircha rasm URL manzillarini har birini yangi qatordan kiriting. Fayl yuklash/storage keyingi qadamda ulanadi.</p>
              <textarea value={form.image_urls} onChange={e => update('image_urls', e.target.value)} rows={4} placeholder="https://...\nhttps://..." className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3" />
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <b className="text-slate-900">E’lon egasi:</b> {profile?.full_name || 'F.I.O. kiritilmagan'} · {profile?.phone || 'Telefon yo‘q'}
              <br />
              <span className="text-slate-500">E’lon ID raqami yuborilgandan so‘ng avtomatik yaratiladi (PH-XXXXXXXX).</span>
            </div>

            {error && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
            {success && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{success}</div>}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/account" className="rounded-2xl border border-slate-200 px-6 py-4 text-center font-bold text-slate-700">Bekor qilish</Link>
              <button disabled={saving} className="rounded-2xl bg-emerald-600 px-8 py-4 font-extrabold text-white shadow-sm disabled:opacity-50">{saving ? 'Joylashtirilmoqda...' : 'E’lonni joylashtirish'}</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}
