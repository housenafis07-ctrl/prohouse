'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ListingLocationPicker from '@/app/components/ListingLocationPicker'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'

type Profile = { full_name: string | null; phone: string | null; account_type: 'individual' | 'partner' | null; partner_type: string | null; trusted_profile: boolean | null }
type Taxonomy = { code: string; name_uz: string; name_ru: string | null; section_code: string; parent_code: string | null; listing_type: string | null; property_type: string | null; is_mortgage_filter: boolean; is_new_construction_filter: boolean; sort_order: number }
type ImageItem = { file: File; preview: string }

const sectionLabels: Record<string, string> = { sale: 'Sotib olish', rent: 'Ijara', new_building: 'Yangi uylar', services: 'Xizmatlar', realtors: 'Rieltorlar' }
const typeLabels: Record<string, string> = { apartment: 'Kvartira', house: 'Xususiy uy', land: 'Yer uchastkasi', commercial: 'Tijorat mulki', new_building: 'Yangi bino' }
const serviceCodes = new Set(['services_construction','services_repair','services_design','services_furniture','services_plumbing','services_electric','services_cleaning','services_moving','services_valuation','services_mortgage_valuation','services_guaranteed_deal','services_cash_deal','services_insurance','services_goods','services_handyman','services_other'])
const realtorCodes = new Set(['realtor_agent','realtor_agency','realtor_company','realtors_agents','realtors_agencies'])
const individualPropertyTypes = new Set(['sale','rent','daily','new_building'])

const districtLabel = (value: string) => value.replace(/ tumani$/i, '').replace(/ shahri$/i, '')

export default function NewListingPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [taxonomy, setTaxonomy] = useState<Taxonomy[]>([])
  const [listingCount, setListingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [images, setImages] = useState<ImageItem[]>([])
  const [mainImage, setMainImage] = useState(0)
  const [location, setLocation] = useState({ latitude: null as number | null, longitude: null as number | null })
  const [sellerRole, setSellerRole] = useState<'owner' | 'seller' | ''>('')
  const [mortgageAvailable, setMortgageAvailable] = useState(false)
  const [form, setForm] = useState({ taxonomy_code: '', listing_type: 'sale', property_type: 'apartment', title: '', description: '', price: '', currency: 'UZS', area_m2: '', rooms: '', floor: '', floors_total: '', city: 'Toshkent', district: '', address: '', contact_phone: '', service_area: '', experience_years: '', company_name: '' })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const [{ data: p }, { data: t, error: te }, { count: lc }] = await Promise.all([
        supabase.from('profiles').select('full_name,phone,account_type,partner_type,trusted_profile').eq('id', user.id).maybeSingle(),
        supabase.from('partner_listing_taxonomy').select('code,name_uz,name_ru,section_code,parent_code,listing_type,property_type,is_mortgage_filter,is_new_construction_filter,sort_order').eq('is_active', true).eq('allows_partner_listing', true).order('sort_order'),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', user.id).in('status', ['draft','moderation','active','reserved','rejected']),
      ])
      if (!mounted) return
      if (te) setError(te.message)
      setProfile(p ?? { full_name: null, phone: user.phone ?? null, account_type: 'individual', partner_type: null, trusted_profile: false })
      setTaxonomy((t ?? []) as Taxonomy[])
      setListingCount(lc ?? 0)
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [router])

  useEffect(() => () => images.forEach(x => URL.revokeObjectURL(x.preview)), [images])

  const update = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value }))
  const trusted = Boolean(profile?.trusted_profile)
  const selectedTaxonomy = taxonomy.find(x => x.code === form.taxonomy_code) ?? null
  const isIndividual = profile?.account_type === 'individual'
  const isPartner = profile?.account_type === 'partner'
  // Rental of a property belongs to the Ijara section, not Xizmatlar.
  const categories = taxonomy.filter(x => x.parent_code && sectionLabels[x.section_code] && x.code !== 'services_rent' && (!isIndividual || individualPropertyTypes.has(x.listing_type || '')))
  const grouped = Object.entries(sectionLabels).map(([section, label]) => ({ section, label, items: categories.filter(x => x.section_code === section) })).filter(x => x.items.length)
  const mode = selectedTaxonomy?.listing_type === 'service' || serviceCodes.has(selectedTaxonomy?.code || '') ? 'service' : selectedTaxonomy?.listing_type === 'realtor' || realtorCodes.has(selectedTaxonomy?.code || '') ? 'realtor' : 'property'

  const selectedLocationRegion = useMemo(() => {
    if (form.city === 'Toshkent' || form.city === 'Ташкент') return UZBEKISTAN_LOCATIONS.find(x => x.name === 'Toshkent shahri') ?? null
    return UZBEKISTAN_LOCATIONS.find(x => x.name === form.city) ?? null
  }, [form.city])

  const districtOptions = selectedLocationRegion?.districts ?? []

  const selectTaxonomy = (item: Taxonomy) => setForm(v => ({ ...v, taxonomy_code: item.code, listing_type: item.listing_type || v.listing_type, property_type: item.property_type || v.property_type }))

  const addImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setError('')
    if (images.length + files.length > 10) return setError('Maksimal 10 ta rasm.')
    const bad = files.find(f => !f.type.startsWith('image/') || f.size > 10 * 1024 * 1024)
    if (bad) return setError('Faqat rasm fayllari, har biri 10 MB gacha.')
    setImages(c => [...c, ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))])
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(''); setSuccess('')
    if (!isPartner && !(isIndividual && mode === 'property')) return setError('Jismoniy shaxs faqat o‘z ko‘chmas mulkini joylashtirishi mumkin.')
    if (isIndividual && listingCount >= 3) return setError('3 ta bepul e’lon limiti tugagan. Mavjud e’lonlardan birini yoping yoki hamkor sifatida ro‘yxatdan o‘ting.')
    if (!selectedTaxonomy) return setError('Bo‘lim va bo‘linmani tanlang.')
    if (mode === 'property' && !sellerRole) return setError('E’lonni joylashtirishdan oldin mulk egasi ekanligingizni yoki sotuvchi ekanligingizni belgilang.')
    const price = Number(form.price.replace(/\s/g, ''))
    if (!form.title.trim()) return setError('E’lon sarlavhasini kiriting.')
    if (!Number.isFinite(price) || price < 0) return setError('To‘g‘ri narx kiriting.')
    if (mode === 'property' && !form.district) return setError('Tuman/shaharni tanlang.')
    if (mode === 'property' && (location.latitude == null || location.longitude == null)) return setError('Xaritadan joylashuvni belgilang.')
    if (mode === 'realtor' && !form.contact_phone.trim() && !profile.phone) return setError('Aloqa telefonini kiriting.')
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const payload = {
        owner_id: user.id,
        taxonomy_code: selectedTaxonomy.code,
        title: form.title.trim(),
        description: form.description.trim() || null,
        listing_type: selectedTaxonomy.listing_type || form.listing_type,
        property_type: selectedTaxonomy.property_type || form.property_type,
        status: 'moderation',
        price,
        currency: form.currency,
        area_m2: form.area_m2 ? Number(form.area_m2) : null,
        rooms: form.rooms ? Number(form.rooms) : null,
        floor: form.floor ? Number(form.floor) : null,
        floors_total: form.floors_total ? Number(form.floors_total) : null,
        city: form.city.trim() || 'Toshkent',
        district: form.district || null,
        neighborhood: null,
        address: form.address.trim() || null,
        latitude: location.latitude,
        longitude: location.longitude,
        seller_type: mode === 'property' ? sellerRole : (isIndividual ? 'owner' : 'realtor'),
        seller_role: mode === 'property' ? sellerRole : (isIndividual ? 'owner' : 'realtor'),
        is_mortgage_available: mode === 'property' && (form.listing_type === 'sale' || form.listing_type === 'new_building') ? mortgageAvailable : false,
        seller_name: form.company_name.trim() || profile.full_name?.trim() || null,
        seller_phone: form.contact_phone.trim() || profile.phone || null,
        is_verified: false,
        is_trusted_seller: trusted,
        published_at: null,
      }
      const { data: listing, error: le } = await supabase.from('listings').insert(payload).select('id,listing_code').single()
      if (le) throw le
      if (images.length) {
        const ordered = [images[mainImage], ...images.filter((_, i) => i !== mainImage)]
        const uploaded = []
        for (let i = 0; i < ordered.length; i++) {
          const file = ordered[i].file
          const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const path = `${user.id}/${listing.id}/${crypto.randomUUID()}-${safe}`
          const { error: ue } = await supabase.storage.from('listing-images').upload(path, file, { cacheControl: '31536000', upsert: false })
          if (ue) throw ue
          const { data: u } = supabase.storage.from('listing-images').getPublicUrl(path)
          uploaded.push({ listing_id: listing.id, image_url: u.publicUrl, sort_order: i })
        }
        const { error: ie } = await supabase.from('listing_images').insert(uploaded)
        if (ie) throw ie
      }
      setSuccess(`E’lon moderatsiyaga yuborildi. ID: ${listing.listing_code}`)
      setTimeout(() => router.push('/account/listings'), 700)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'E’lonni saqlashda xatolik.'
      setError(message.includes('INDIVIDUAL_LISTING_LIMIT') ? '3 ta bepul e’lon limiti tugagan. Mavjud e’lonlardan birini yoping yoki hamkor sifatida ro‘yxatdan o‘ting.' : message)
    } finally { setSaving(false) }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 text-center">Yuklanmoqda...</div></main>
  if (!profile) return null

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10"><div className="mx-auto max-w-5xl">
    <header className="mb-5 flex items-center justify-between"><Link href="/account" className="text-sm font-extrabold text-emerald-700">← Shaxsiy kabinet</Link><Link href="/listings" className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">E’lonlarni ko‘rish</Link></header>
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="bg-slate-900 px-6 py-7 text-white sm:px-8"><p className="text-sm font-semibold text-slate-300">{isPartner ? 'Prohouse hamkor kabineti' : 'Prohouse shaxsiy kabineti'}</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">E’lon joylashtirish</h1><p className="mt-2 text-sm text-slate-300">{isIndividual ? `Jismoniy shaxs uchun ${listingCount}/3 ta bepul e’lon ishlatilgan.` : 'E’loningiz qaysi bo‘lim va bo‘linmaga tegishli ekanini tanlang.'}</p></div>
      {isIndividual && listingCount >= 3 ? <div className="p-8"><div className="rounded-2xl border border-amber-100 bg-amber-50 p-5"><p className="font-extrabold text-amber-900">Bepul e’lon limiti tugagan</p><p className="mt-1 text-sm text-amber-800">Jismoniy shaxs sifatida 3 ta e’longacha bepul joylashtirishingiz mumkin. Yangi e’lon uchun mavjud e’lonlardan birini yoping yoki hamkor sifatida ro‘yxatdan o‘ting.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/account/listings" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Mening e’lonlarim</Link><Link href="/register?type=partner" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">Hamkor bo‘lish</Link></div></div></div> : <form onSubmit={submit} className="space-y-8 p-6 sm:p-8">
        <div><h2 className="text-lg font-extrabold">1. E’lon bo‘limi va bo‘linmasi</h2><div className="mt-5 space-y-5">{grouped.map(g => <div key={g.section} className="rounded-2xl border p-4"><h3 className="font-extrabold">{g.label}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{g.items.map(item => <button type="button" key={item.code} onClick={() => selectTaxonomy(item)} className={`rounded-2xl border p-4 text-left ${form.taxonomy_code === item.code ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white'}`}><span className="block font-extrabold">{item.name_uz}</span><span className="mt-1 block text-xs text-slate-500">{item.listing_type === 'service' ? 'Xizmat' : item.listing_type === 'realtor' ? 'Rieltor' : item.listing_type === 'daily' ? 'Kunlik ijara' : item.listing_type === 'rent' ? 'Ijara' : item.is_new_construction_filter ? 'Yangi qurilish' : item.is_mortgage_filter ? 'Ipotekaga mumkin' : typeLabels[item.property_type || ''] || ''}</span></button>)}</div></div>)}</div>{selectedTaxonomy && <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm"><b>{selectedTaxonomy.name_uz}</b>{mode === 'service' && <span className="ml-2 rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-700">Xizmat e’loni</span>}{mode === 'realtor' && <span className="ml-2 rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-700">Rieltor e’loni</span>}{isIndividual && <span className="ml-2 rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-700">Mulk egasi</span>}</div>}</div>
        {mode === 'property' && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-extrabold">2. E’lon egasi va sotuv shartlari</h2>
          <p className="mt-1 text-sm text-slate-500">Bu ma’lumotlar avtomatik belgilanmaydi. E’lonni joylashtirishdan oldin o‘zingiz tanlaysiz.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${sellerRole === 'owner' ? 'border-emerald-500 bg-white ring-2 ring-emerald-100' : 'border-slate-200 bg-white'}`}>
              <input type="radio" name="seller-role" checked={sellerRole === 'owner'} onChange={() => setSellerRole('owner')} className="mt-1" />
              <span><b className="block">Mulk egasiman</b><span className="mt-1 block text-xs text-slate-500">E’lon bevosita mulk egasidan.</span></span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${sellerRole === 'seller' ? 'border-emerald-500 bg-white ring-2 ring-emerald-100' : 'border-slate-200 bg-white'}`}>
              <input type="radio" name="seller-role" checked={sellerRole === 'seller'} onChange={() => setSellerRole('seller')} className="mt-1" />
              <span><b className="block">Mulk egasi emasman</b><span className="mt-1 block text-xs text-slate-500">Sotuvchi yoki vakil sifatida e’lon berilmoqda.</span></span>
            </label>
          </div>
          {(form.listing_type === 'sale' || form.listing_type === 'new_building') && <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <input type="checkbox" checked={mortgageAvailable} onChange={e => setMortgageAvailable(e.target.checked)} className="mt-1" />
            <span><b className="block">Ipotekaga sotish mumkin</b><span className="mt-1 block text-xs text-slate-500">Xaridor bank ipotekasi orqali sotib olishi mumkin bo‘lsa belgilang.</span></span>
          </label>}
        </div>

        <div><h2 className="text-lg font-extrabold">2. E’lon ma’lumotlari</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-bold">E’lon sarlavhasi *</span><input value={form.title} onChange={e => update('title', e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder={mode === 'service' ? 'Masalan: Professional ta’mirlash xizmati' : mode === 'realtor' ? 'Masalan: Toshkent bo‘yicha tajribali rieltor' : 'Masalan: 3 xonali shinam kvartira'} required /></label><label><span className="text-sm font-bold">Narx *</span><input inputMode="numeric" value={form.price} onChange={e => update('price', e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder={mode === 'service' ? 'Kelishiladi' : '850000000'} required /></label><label className="sm:col-span-2"><span className="text-sm font-bold">Tavsif</span><textarea value={form.description} onChange={e => update('description', e.target.value)} rows={5} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder={mode === 'service' ? 'Xizmat, narx, kafolat va ish tartibi haqida...' : mode === 'realtor' ? 'Tajriba, hududlar va ko‘rsatiladigan xizmatlar haqida...' : 'Uy va mulk haqida batafsil ma’lumot...'} /></label></div></div>
        {(mode === 'service' || mode === 'realtor') && <div><h2 className="text-lg font-extrabold">3. Aloqa va xizmat ma’lumotlari</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-bold">Aloqa telefoni *</span><input value={form.contact_phone} onChange={e => update('contact_phone', e.target.value)} placeholder={profile.phone || '+998 90 000 00 00'} className="mt-2 w-full rounded-xl border px-4 py-3" /></label><label><span className="text-sm font-bold">Kompaniya / mutaxassis</span><input value={form.company_name} onChange={e => update('company_name', e.target.value)} placeholder={profile.full_name || 'Nom'} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>{mode === 'realtor' && <label><span className="text-sm font-bold">Tajriba (yil)</span><input value={form.experience_years} onChange={e => update('experience_years', e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>}<label><span className="text-sm font-bold">Xizmat hududi</span><input value={form.service_area} onChange={e => update('service_area', e.target.value)} placeholder="Toshkent shahri va viloyati" className="mt-2 w-full rounded-xl border px-4 py-3" /></label></div></div>}
        {mode === 'property' && <div><h2 className="text-lg font-extrabold">3. Manzil</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label><span className="text-sm font-bold">Shahar</span><select value={form.city} onChange={e => setForm(v => ({ ...v, city: e.target.value, district: '' }))} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="Toshkent">Toshkent</option>{UZBEKISTAN_LOCATIONS.filter(x => x.name !== 'Toshkent shahri').map(region => <option key={region.name} value={region.name}>{region.name}</option>)}</select></label>
          <label><span className="text-sm font-bold">Tuman / shahar *</span><select value={form.district} onChange={e => update('district', e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" required><option value="">Tuman / shaharni tanlang</option>{districtOptions.map(district => <option key={district} value={district}>{districtLabel(district)}</option>)}</select></label>
          <label className="sm:col-span-2"><span className="text-sm font-bold">Manzil</span><input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Ko‘cha, uy raqami va boshqa ma’lumot" className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
        </div><div className="mt-5"><ListingLocationPicker latitude={location.latitude} longitude={location.longitude} onChange={(latitude, longitude) => setLocation({ latitude, longitude })} /></div></div>}
        <div><h2 className="text-lg font-extrabold">4. Rasmlar</h2><label className="mt-4 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed p-8 text-sm font-bold"><input type="file" accept="image/*" multiple className="hidden" onChange={addImages} />+ Rasmlar qo‘shish</label>{images.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{images.map((x, i) => <button type="button" key={x.preview} onClick={() => setMainImage(i)} className={`overflow-hidden rounded-xl border-2 ${mainImage === i ? 'border-emerald-500' : 'border-transparent'}`}><img src={x.preview} alt="" className="h-28 w-full object-cover" /></button>)}</div>}</div>
        {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}{success && <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}<button disabled={saving} className="w-full rounded-2xl bg-emerald-600 px-5 py-4 font-extrabold text-white disabled:opacity-60">{saving ? 'Yuborilmoqda...' : 'Moderatsiyaga yuborish'}</button>
      </form>}
    </section>
  </div></main>
}
