'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

type Lang = 'uz' | 'ru'
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
  published_at: string | null
  image_url?: string
}

const fallback: Listing[] = [
  { id: '1', title: '2 xonali zamonaviy kvartira', listing_type: 'sale', property_type: 'apartment', price: 860000000, currency: 'UZS', area_m2: 58, rooms: 2, floor: 5, floors_total: 9, district: 'Yunusobod', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: true, is_verified: true, is_featured: true, published_at: null, image_url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85' },
  { id: '2', title: 'Yangi qurilgan premium uy', listing_type: 'sale', property_type: 'new_building', price: 1240000000, currency: 'UZS', area_m2: 120, rooms: 4, floor: 2, floors_total: 2, district: 'Mirzo Ulug‘bek', city: 'Toshkent', seller_type: 'developer', seller_name: 'Rieltor', is_mortgage_available: true, is_verified: true, is_featured: true, published_at: null, image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85' },
  { id: '3', title: '3 xonali yorug‘ kvartira', listing_type: 'sale', property_type: 'apartment', price: 950000000, currency: 'UZS', area_m2: 72, rooms: 3, floor: 7, floors_total: 12, district: 'Chilonzor', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: true, is_verified: true, is_featured: true, published_at: null, image_url: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85' },
  { id: '4', title: 'Keng hovlili xususiy uy', listing_type: 'sale', property_type: 'house', price: 185000, currency: 'USD', area_m2: 190, rooms: 5, floor: 2, floors_total: 2, district: 'Mirzo Ulug‘bek', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: null, image_url: 'https://images.unsplash.com/photo-1605146769289-440113cc3d00?auto=format&fit=crop&w=1000&q=85' },
  { id: '5', title: 'Hovlili uy, tayyor holatda', listing_type: 'sale', property_type: 'house', price: 149000, currency: 'USD', area_m2: 200, rooms: 5, floor: 2, floors_total: 2, district: 'Sergeli', city: 'Toshkent', seller_type: 'realtor', seller_name: 'Rieltor', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: null, image_url: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85' },
  { id: '6', title: '2 xonali kvartira', listing_type: 'sale', property_type: 'apartment', price: 90000, currency: 'USD', area_m2: 64, rooms: 2, floor: 4, floors_total: 9, district: 'Yakkasaroy', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: null, image_url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85' },
  { id: '7', title: 'Tijorat uchun qulay bino', listing_type: 'sale', property_type: 'commercial', price: 135000, currency: 'USD', area_m2: 123, rooms: 0, floor: 1, floors_total: 1, district: 'Chilonzor', city: 'Toshkent', seller_type: 'realtor', seller_name: 'Rieltor', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: null, image_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85' },
]

const labels = {
  uz: { title: 'Ko‘chmas mulk e’lonlari', sub: 'Sizga mos uy, kvartira yoki tijorat obyektini toping.', sale: 'Sotuv', rent: 'Ijara', daily: 'Kunlik', all: 'Barchasi', search: 'Qidirish', reset: 'Tozalash', filters: 'Filtrlar', district: 'Tuman', type: 'Mulk turi', price: 'Narx', rooms: 'Xonalar', any: 'Barchasi', apartment: 'Kvartira', house: 'Xususiy uy', land: 'Yer', commercial: 'Tijorat', newBuilding: 'Yangi bino', mortgage: 'Ipotekaga mumkin', owner: 'Egadan', verified: 'Tasdiqlangan', found: 'ta e’lon', newest: 'Eng yangi', priceLow: 'Arzonidan', priceHigh: 'Qimmatidan', home: 'Bosh sahifa', view: 'Ko‘rish', perMonth: '/oyiga', perDay: '/kuniga' },
  ru: { title: 'Объявления недвижимости', sub: 'Найдите подходящий дом, квартиру или коммерческий объект.', sale: 'Продажа', rent: 'Аренда', daily: 'Посуточно', all: 'Все', search: 'Найти', reset: 'Сбросить', filters: 'Фильтры', district: 'Район', type: 'Тип недвижимости', price: 'Цена', rooms: 'Комнаты', any: 'Все', apartment: 'Квартира', house: 'Частный дом', land: 'Земля', commercial: 'Коммерция', newBuilding: 'Новостройка', mortgage: 'Ипотека', owner: 'От владельца', verified: 'Проверено', found: 'объявлений', newest: 'Новые', priceLow: 'Сначала дешевле', priceHigh: 'Сначала дороже', home: 'Главная', view: 'Смотреть', perMonth: '/мес.', perDay: '/день' },
}

const ruTitles: Record<string, string> = {
  '2 xonali zamonaviy kvartira': 'Современная 2-комнатная квартира',
  'Yangi qurilgan premium uy': 'Новый дом премиум-класса',
  '3 xonali yorug‘ kvartira': 'Светлая 3-комнатная квартира',
  'Keng hovlili xususiy uy': 'Просторный частный дом с двором',
  'Hovlili uy, tayyor holatda': 'Готовый дом с двором',
  '2 xonali kvartira': '2-комнатная квартира',
  'Tijorat uchun qulay bino': 'Коммерческое помещение',
}

const money = (value: number, currency: string) => `${new Intl.NumberFormat('ru-RU').format(value)} ${currency === 'USD' ? '$' : 'сўм'}`

export default function ListingsPage() {
  const [lang, setLang] = useState<Lang>('uz')
  const [listings, setListings] = useState<Listing[]>(fallback)
  const [tab, setTab] = useState('sale')
  const [district, setDistrict] = useState('')
  const [type, setType] = useState('')
  const [rooms, setRooms] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [mortgage, setMortgage] = useState(false)
  const [owner, setOwner] = useState(false)
  const [verified, setVerified] = useState(false)
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)

  const text = labels[lang]

  useEffect(() => {
    const saved = window.localStorage.getItem('prohouse-lang') as Lang | null
    if (saved === 'uz' || saved === 'ru') setLang(saved)

    const params = new URLSearchParams(window.location.search)
    const requestedTab = params.get('tab')
    const requestedType = params.get('type')
    if (requestedTab === 'sale' || requestedTab === 'rent' || requestedTab === 'daily' || requestedTab === 'all') setTab(requestedTab)
    if (requestedTab === 'new') { setTab('sale'); setType('new_building') }
    if (requestedType) setType(requestedType)
    if (params.get('mortgage') === 'true') setMortgage(true)

    let mounted = true
    const loadListings = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('listings')
          .select('*, listing_images(image_url,sort_order)')
          .eq('status', 'active')

        if (mounted && data?.length) {
          setListings(data.map((row: any) => ({
            ...row,
            image_url: row.listing_images?.slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))?.[0]?.image_url,
          })))
        }
      } catch {
        // Keep the built-in fallback listings when Supabase is unavailable.
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadListings()
    return () => { mounted = false }
  }, [])

  const districts = useMemo(() => Array.from(new Set(listings.map(x => x.district).filter(Boolean) as string[])).sort(), [listings])

  const filtered = useMemo(() => {
    const min = Number(minPrice.replace(/\s/g, '')) || 0
    const max = Number(maxPrice.replace(/\s/g, '')) || Number.POSITIVE_INFINITY
    return listings
      .filter(x => tab === 'all' || x.listing_type === tab)
      .filter(x => !district || x.district === district)
      .filter(x => !type || x.property_type === type)
      .filter(x => !rooms || (x.rooms ?? 0) >= Number(rooms))
      .filter(x => x.price >= min && x.price <= max)
      .filter(x => !mortgage || x.is_mortgage_available)
      .filter(x => !owner || x.seller_type === 'owner')
      .filter(x => !verified || x.is_verified)
      .sort((a, b) => {
        if (sort === 'priceLow') return a.price - b.price
        if (sort === 'priceHigh') return b.price - a.price
        return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()
      })
  }, [listings, tab, district, type, rooms, minPrice, maxPrice, mortgage, owner, verified, sort])

  const clearFilters = () => {
    setTab('sale'); setDistrict(''); setType(''); setRooms(''); setMinPrice(''); setMaxPrice(''); setMortgage(false); setOwner(false); setVerified(false); setSort('newest')
  }

  const displayTitle = (item: Listing) => lang === 'ru' ? (ruTitles[item.title] || item.title) : item.title

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-slate-900"><span className="mr-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">⌂</span>Pro<span className="text-emerald-500">house</span></Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex"><Link href="/" className="hover:text-emerald-600">{text.home}</Link><a href="#catalog" className="text-emerald-600">{text.title}</a></nav>
          <button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => { const next = lang === 'uz' ? 'ru' : 'uz'; setLang(next); window.localStorage.setItem('prohouse-lang', next) }}>{lang === 'uz' ? 'O‘z / Ru' : 'Ru / O‘z'}</button>
        </div>
      </header>

      <section className="bg-slate-900 px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl"><div className="mb-4 text-sm text-emerald-300"><Link href="/">Prohouse</Link> <span className="mx-2">›</span> {text.title}</div><h1 className="text-3xl font-black sm:text-5xl">{text.title}</h1><p className="mt-3 max-w-2xl text-slate-300">{text.sub}</p></div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" id="catalog">
        <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
          {([['sale', text.sale], ['rent', text.rent], ['daily', text.daily], ['all', text.all]] as const).map(([value, label]) => <button key={value} className={`whitespace-nowrap rounded-xl px-5 py-3 text-sm font-bold ${tab === value ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`} onClick={() => setTab(value)}>{label}</button>)}
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <div className="mb-5 flex items-center justify-between"><strong>{text.filters}</strong><button className="text-xs font-semibold text-emerald-600" onClick={clearFilters}>{text.reset}</button></div>
            <div className="space-y-4">
              <label className="block text-sm font-semibold">{text.district}<select className="mt-2 w-full rounded-xl border p-3 font-normal" value={district} onChange={e => setDistrict(e.target.value)}><option value="">{text.any}</option>{districts.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
              <label className="block text-sm font-semibold">{text.type}<select className="mt-2 w-full rounded-xl border p-3 font-normal" value={type} onChange={e => setType(e.target.value)}><option value="">{text.any}</option><option value="apartment">{text.apartment}</option><option value="house">{text.house}</option><option value="land">{text.land}</option><option value="commercial">{text.commercial}</option><option value="new_building">{text.newBuilding}</option></select></label>
              <label className="block text-sm font-semibold">{text.rooms}<select className="mt-2 w-full rounded-xl border p-3 font-normal" value={rooms} onChange={e => setRooms(e.target.value)}><option value="">{text.any}</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}</select></label>
              <div><div className="mb-2 text-sm font-semibold">{text.price}</div><div className="grid grid-cols-2 gap-2"><input inputMode="numeric" placeholder="Min" className="w-full rounded-xl border p-3" value={minPrice} onChange={e => setMinPrice(e.target.value)} /><input inputMode="numeric" placeholder="Max" className="w-full rounded-xl border p-3" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} /></div></div>
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={mortgage} onChange={e => setMortgage(e.target.checked)} />{text.mortgage}</label>
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={owner} onChange={e => setOwner(e.target.checked)} />{text.owner}</label>
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />{text.verified}</label>
            </div>
          </aside>

          <section id="results">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-slate-500">{loading ? '...' : `${filtered.length} ${text.found}`}</div><select className="rounded-xl border bg-white px-3 py-2 text-sm" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">{text.newest}</option><option value="priceLow">{text.priceLow}</option><option value="priceHigh">{text.priceHigh}</option></select></div>
            {filtered.length === 0 ? <div className="rounded-2xl bg-white p-12 text-center text-slate-500">{lang === 'uz' ? 'E’lonlar topilmadi.' : 'Объявления не найдены.'}</div> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(item => <article key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-lg">
              <div className="relative aspect-[4/3] bg-slate-100">{item.image_url ? <img src={item.image_url} alt={displayTitle(item)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400">Prohouse</div>}{item.is_featured && <span className="absolute left-3 top-3 rounded-lg bg-amber-400 px-2 py-1 text-xs font-black text-slate-900">VIP</span>}{item.is_verified && <span className="absolute right-3 top-3 rounded-lg bg-white/95 px-2 py-1 text-xs font-bold text-emerald-700">✓ {text.verified}</span>}</div>
              <div className="p-4"><h2 className="line-clamp-2 font-bold">{displayTitle(item)}</h2><div className="mt-2 text-lg font-black text-emerald-600">{money(item.price, item.currency)}</div><div className="mt-2 text-sm text-slate-500">{item.area_m2 ? `${item.area_m2} m²` : ''}{item.rooms ? ` • ${item.rooms} xona` : ''}{item.floor ? ` • ${item.floor}/${item.floors_total}` : ''}</div><div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{item.district || item.city}</span><button className="rounded-lg bg-emerald-50 px-3 py-2 font-bold text-emerald-700">{text.view}</button></div></div>
            </article>)}</div>}
          </section>
        </div>
      </section>
    </main>
  )
}
