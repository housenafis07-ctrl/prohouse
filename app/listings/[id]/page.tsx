'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type ListingImage = { image_url: string; sort_order: number | null }
type Listing = {
  id: string
  title: string
  title_ru?: string | null
  description?: string | null
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
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  seller_type: string
  seller_name: string | null
  is_mortgage_available: boolean
  is_verified: boolean
  is_featured: boolean
  published_at: string | null
  listing_images?: ListingImage[]
}

const money = (value: number, currency: string) => `${new Intl.NumberFormat('ru-RU').format(value)} ${currency === 'USD' ? 'у.е.' : 'so‘m'}`

function Map({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (latitude == null || longitude == null) return
    const id = 'prohouse-leaflet-js'
    const init = () => setReady(true)
    if ((window as any).L) init()
    else {
      const existing = document.getElementById(id) as HTMLScriptElement | null
      if (existing) existing.addEventListener('load', init)
      else {
        const script = document.createElement('script')
        script.id = id
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.async = true
        script.onload = init
        document.body.appendChild(script)
      }
    }
    return () => { const script = document.getElementById(id); script?.removeEventListener('load', init) }
  }, [latitude, longitude])

  useEffect(() => {
    if (!ready || latitude == null || longitude == null || !(window as any).L) return
    const L = (window as any).L
    const element = document.getElementById('listing-detail-map')
    if (!element || element.dataset.ready === '1') return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    if (!document.querySelector('link[href*="leaflet@1.9.4"]')) document.head.appendChild(link)
    const map = L.map(element).setView([latitude, longitude], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
    L.marker([latitude, longitude]).addTo(map)
    element.dataset.ready = '1'
    setTimeout(() => map.invalidateSize(), 100)
    return () => { map.remove(); delete element.dataset.ready }
  }, [ready, latitude, longitude])

  if (latitude == null || longitude == null) return <div className="flex h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Bu e’lon uchun xaritada aniq joylashuv belgilanmagan.</div>
  return <div><div id="listing-detail-map" className="h-[360px] w-full rounded-2xl border border-slate-200 bg-slate-100" /><a className="mt-3 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-emerald-500 hover:text-emerald-600" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`}>Xaritani katta ko‘rish →</a></div>
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>()
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lang, setLang] = useState<'uz' | 'ru'>('uz')

  useEffect(() => {
    const saved = window.localStorage.getItem('prohouse-lang')
    if (saved === 'ru') setLang('ru')
    let mounted = true
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('listings').select('*, listing_images(image_url,sort_order)').eq('id', params.id).maybeSingle()
        if (error) throw error
        if (!data) throw new Error('E’lon topilmadi')
        if (mounted) setListing(data as Listing)
      } catch (e: any) {
        if (mounted) setError(e?.message || 'E’lonni yuklashda xatolik yuz berdi.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    if (params.id) void load()
    return () => { mounted = false }
  }, [params.id])

  if (loading) return <main className="min-h-screen bg-[#f6f7f8] p-8 text-center text-slate-500">Yuklanmoqda...</main>
  if (error || !listing) return <main className="min-h-screen bg-[#f6f7f8] p-8"><div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center"><h1 className="text-xl font-black">{error || 'E’lon topilmadi'}</h1><Link href="/listings" className="mt-5 inline-flex rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white">E’lonlarga qaytish</Link></div></main>

  const images = (listing.listing_images || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const title = lang === 'ru' ? (listing.title_ru || listing.title) : listing.title
  const typeLabel: Record<string, string> = { apartment: 'Kvartira', house: 'Xususiy uy', new_building: 'Yangi bino', commercial: 'Tijorat', land: 'Yer' }

  return <main className="min-h-screen bg-[#f6f7f8] text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6"><Link href="/listings" className="font-black text-emerald-600">← Prohouse</Link><button onClick={() => { const next = lang === 'uz' ? 'ru' : 'uz'; setLang(next); window.localStorage.setItem('prohouse-lang', next) }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">{lang === 'uz' ? 'O‘z / Ru' : 'Ru / O‘z'}</button></div></header>
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-5 text-sm text-slate-500"><Link href="/listings" className="hover:text-emerald-600">E’lonlar</Link> <span className="mx-2">›</span> {title}</div>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[1.35fr_.65fr]">
          <div className="bg-slate-100">{images.length ? <img src={images[0].image_url} alt={title} className="h-[420px] w-full object-cover sm:h-[520px]"/> : <div className="flex h-[420px] items-center justify-center text-slate-400">Rasm mavjud emas</div>}</div>
          <div className="p-6 sm:p-8"><div className="flex flex-wrap gap-2">{listing.is_featured && <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-black">TOP</span>}{listing.is_verified && <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">✓ Tasdiqlangan</span>}</div><h1 className="mt-4 text-2xl font-black sm:text-3xl">{title}</h1><p className="mt-3 text-2xl font-black text-emerald-600">{money(listing.price, listing.currency)}</p><p className="mt-3 text-sm text-slate-500">⌖ {listing.city}{listing.district ? `, ${listing.district}` : ''}{listing.address ? `, ${listing.address}` : ''}</p><div className="mt-6 grid grid-cols-2 gap-3">{listing.area_m2 != null && <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-400">Maydon</span><b className="mt-1 block">{listing.area_m2} m²</b></div>}{listing.rooms != null && <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-400">Xonalar</span><b className="mt-1 block">{listing.rooms}</b></div>}{listing.floor != null && <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-400">Qavat</span><b className="mt-1 block">{listing.floor}/{listing.floors_total}</b></div>}<div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-400">Mulk turi</span><b className="mt-1 block">{typeLabel[listing.property_type] || listing.property_type}</b></div></div><div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">Sotuvchi</p><p className="mt-1 font-black">{listing.seller_name || 'Sotuvchi'}</p>{listing.is_verified && <p className="mt-1 text-xs text-emerald-700">✓ Tasdiqlangan profil</p>}</div></div>
        </div>
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]"><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Tavsif</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{listing.description || 'Tavsif kiritilmagan.'}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Joylashuv</h2><p className="mt-1 mb-4 text-sm text-slate-500">E’lon beruvchi belgilagan joylashuv</p><Map latitude={listing.latitude ?? null} longitude={listing.longitude ?? null}/></div></section>
      <section className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-6"><h2 className="text-lg font-black">Xavfsiz bitim</h2><p className="mt-1 text-sm text-slate-600">ProHouse tasdiqlangan e’lonlar va sotuvchilarni ajratib ko‘rsatadi. To‘lov/escrow xizmatlari keyingi integratsiya bosqichida litsenziyalangan hamkor orqali amalga oshiriladi.</p></section>
    </div>
  </main>
}
