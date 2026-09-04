'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Listing = {
  id: string
  title: string
  listing_type: string
  property_type: string
  price: number
  currency: string
  area_m2: number | null
  rooms: number | null
  floor: number | null
  floors_total: number | null
  district: string | null
  city: string
  seller_type: string
  seller_name: string | null
  is_mortgage_available: boolean
  is_verified: boolean
  is_featured: boolean
  description?: string | null
  published_at?: string | null
  image_url?: string
  images?: string[]
}

const demo: Record<string, Listing> = {
  '1': { id: '1', title: '2 xonali zamonaviy kvartira', listing_type: 'sale', property_type: 'apartment', price: 860000000, currency: 'UZS', area_m2: 58, rooms: 2, floor: 5, floors_total: 9, district: 'Yunusobod', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: true, is_verified: true, is_featured: true, image_url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=90', images: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=90', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=85', 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85'] },
  '2': { id: '2', title: 'Yangi qurilgan premium uy', listing_type: 'sale', property_type: 'new_building', price: 1240000000, currency: 'UZS', area_m2: 120, rooms: 4, floor: 2, floors_total: 2, district: 'Mirzo Ulug‘bek', city: 'Toshkent', seller_type: 'developer', seller_name: 'Prohouse Developer', is_mortgage_available: true, is_verified: true, is_featured: true, image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=90', images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=90'] },
}

const money = (value: number, currency: string) => `${new Intl.NumberFormat('ru-RU').format(value)} ${currency === 'USD' ? 'у.е.' : 'so‘m'}`

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [saved, setSaved] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('listings')
          .select('*, listing_images(image_url,sort_order)')
          .eq('id', id)
          .maybeSingle()
        if (!error && data && mounted) {
          const images = (data.listing_images ?? [])
            .slice()
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((item: any) => item.image_url)
            .filter(Boolean)
          setListing({ ...data, image_url: images[0], images })
          setLoading(false)
          return
        }
      } catch {
        // Demo fallback keeps the page usable before the database is populated.
      }
      if (mounted) {
        setListing(demo[id] ?? demo['1'])
        setLoading(false)
      }
    }
    if (id) load()
    return () => { mounted = false }
  }, [id])

  const images = useMemo(() => listing?.images?.length ? listing.images : listing?.image_url ? [listing.image_url] : [], [listing])
  const currentImage = images[activeImage] ?? ''

  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-6xl rounded-2xl bg-white p-10 text-center text-slate-500">Yuklanmoqda...</div></main>
  if (!listing) return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-6xl rounded-2xl bg-white p-10 text-center">E’lon topilmadi</div></main>

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-emerald-600">Bosh sahifa</Link><span>›</span>
          <Link href="/listings" className="hover:text-emerald-600">E’lonlar</Link><span>›</span><span className="truncate text-slate-700">{listing.title}</span>
        </div>

        <section className="grid gap-5 lg:grid-cols-[1.65fr_1fr]">
          <div>
            <div className="relative overflow-hidden rounded-2xl bg-slate-200 shadow-sm">
              {currentImage && <img src={currentImage} alt={listing.title} className="h-[420px] w-full object-cover sm:h-[540px]" />}
              {listing.is_featured && <span className="absolute left-4 top-4 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">TOP</span>}
              <button aria-label="Saqlash" onClick={() => setSaved(!saved)} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl shadow">{saved ? '♥' : '♡'}</button>
            </div>
            {images.length > 1 && <div className="mt-3 grid grid-cols-4 gap-3">{images.map((image, index) => <button key={image} onClick={() => setActiveImage(index)} className={`overflow-hidden rounded-xl border-2 ${activeImage === index ? 'border-emerald-500' : 'border-transparent'}`}><img src={image} alt="" className="h-20 w-full object-cover" /></button>)}</div>}
          </div>

          <aside className="rounded-2xl bg-white p-6 shadow-sm sm:p-7 lg:sticky lg:top-5 lg:h-fit">
            <div className="mb-3 flex flex-wrap gap-2">
              {listing.is_verified && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">✓ Tasdiqlangan</span>}
              {listing.is_mortgage_available && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Ipotekaga mumkin</span>}
            </div>
            <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{listing.title}</h1>
            <p className="mt-2 text-sm text-slate-500">{listing.city}{listing.district ? `, ${listing.district}` : ''}</p>
            <div className="mt-6 text-3xl font-extrabold text-slate-900">{money(listing.price, listing.currency)}</div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Maydon</span><b>{listing.area_m2 ?? '—'} m²</b></div>
              <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Xonalar</span><b>{listing.rooms ?? '—'}</b></div>
              <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Qavat</span><b>{listing.floor ?? '—'} / {listing.floors_total ?? '—'}</b></div>
              <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Turi</span><b>{listing.property_type === 'apartment' ? 'Kvartira' : listing.property_type === 'house' ? 'Xususiy uy' : listing.property_type === 'new_building' ? 'Yangi bino' : 'Ko‘chmas mulk'}</b></div>
            </div>
            <button onClick={() => setContactOpen(true)} className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3.5 font-bold text-white transition hover:bg-emerald-700">☎ Sotuvchi bilan bog‘lanish</button>
            <button onClick={() => setSaved(!saved)} className="mt-3 w-full rounded-xl border border-slate-200 px-5 py-3.5 font-semibold text-slate-700 hover:bg-slate-50">{saved ? '♥ Saqlangan' : '♡ Saqlash'}</button>
            <div className="mt-5 border-t pt-5 text-sm text-slate-500">Sotuvchi: <b className="text-slate-800">{listing.seller_name ?? 'Sotuvchi'}</b></div>
          </aside>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.65fr_1fr]">
          <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-7">
            <h2 className="text-xl font-bold text-slate-900">E’lon haqida</h2>
            <p className="mt-4 leading-7 text-slate-600">{listing.description || 'Ko‘chmas mulk haqida batafsil ma’lumot tez orada qo‘shiladi. Hozircha asosiy parametrlar va sotuvchi ma’lumotlari yuqorida ko‘rsatilgan.'}</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-7">
            <h2 className="text-xl font-bold text-slate-900">Xavfsiz bitim</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Tasdiqlangan e’lon va sotuvchi bilan bog‘laning. Muhim hujjatlarni tekshirmasdan oldindan to‘lov qilmang.</p>
          </div>
        </section>
      </div>

      {contactOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center" onClick={() => setContactOpen(false)}>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Sotuvchi bilan bog‘lanish</h2><button onClick={() => setContactOpen(false)} className="text-2xl text-slate-400">×</button></div>
          <p className="mt-3 text-sm text-slate-500">{listing.seller_name ?? 'Sotuvchi'} bilan bog‘lanish usulini tanlang.</p>
          <button className="mt-5 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white">☎ Telefon raqamini ko‘rsatish</button>
          <Link href={`/chat?listing=${encodeURIComponent(listing.id)}`} onClick={() => setContactOpen(false)} className="mt-3 block w-full rounded-xl border border-slate-200 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50">💬 Prohouse chat</Link>
        </div>
      </div>}
    </main>
  )
}
