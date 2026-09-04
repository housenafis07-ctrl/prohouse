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
  { id: '1', title: '2 xonali zamonaviy kvartira', listing_type: 'sale', property_type: 'apartment', price: 860000000, currency: 'UZS', area_m2: 58, rooms: 2, floor: 5, floors_total: 9, district: 'Yunusobod', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: true, is_verified: true, is_featured: true, published_at: '2026-09-04T10:00:00Z', image_url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85' },
  { id: '2', title: 'Yangi qurilgan premium uy', listing_type: 'sale', property_type: 'new_building', price: 1240000000, currency: 'UZS', area_m2: 120, rooms: 4, floor: 2, floors_total: 2, district: 'Mirzo Ulug‘bek', city: 'Toshkent', seller_type: 'developer', seller_name: 'Prohouse Developer', is_mortgage_available: true, is_verified: true, is_featured: true, published_at: '2026-09-03T12:00:00Z', image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85' },
  { id: '3', title: '3 xonali yorug‘ kvartira', listing_type: 'sale', property_type: 'apartment', price: 950000000, currency: 'UZS', area_m2: 72, rooms: 3, floor: 7, floors_total: 12, district: 'Chilonzor', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: true, is_verified: true, is_featured: true, published_at: '2026-09-02T09:00:00Z', image_url: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85' },
  { id: '4', title: 'Keng hovlili xususiy uy', listing_type: 'sale', property_type: 'house', price: 185000, currency: 'USD', area_m2: 190, rooms: 5, floor: 2, floors_total: 2, district: 'Mirzo Ulug‘bek', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: '2026-09-01T08:00:00Z', image_url: 'https://images.unsplash.com/photo-1605146769289-440113cc3d00?auto=format&fit=crop&w=1200&q=85' },
  { id: '5', title: 'Hovlili uy, tayyor holatda', listing_type: 'sale', property_type: 'house', price: 149000, currency: 'USD', area_m2: 200, rooms: 5, floor: 2, floors_total: 2, district: 'Sergeli', city: 'Toshkent', seller_type: 'realtor', seller_name: 'Prohouse Realty', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: '2026-08-31T15:00:00Z', image_url: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85' },
  { id: '6', title: '2 xonali kvartira', listing_type: 'sale', property_type: 'apartment', price: 90000, currency: 'USD', area_m2: 64, rooms: 2, floor: 4, floors_total: 9, district: 'Yakkasaroy', city: 'Toshkent', seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: '2026-08-30T11:00:00Z', image_url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85' },
  { id: '7', title: 'Tijorat uchun qulay bino', listing_type: 'sale', property_type: 'commercial', price: 135000, currency: 'USD', area_m2: 123, rooms: null, floor: 1, floors_total: 1, district: 'Chilonzor', city: 'Toshkent', seller_type: 'realtor', seller_name: 'Prohouse Realty', is_mortgage_available: false, is_verified: true, is_featured: false, published_at: '2026-08-29T10:00:00Z', image_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85' },
]

const ruTitles: Record<string, string> = {
  '2 xonali zamonaviy kvartira': 'Современная 2-комнатная квартира',
  'Yangi qurilgan premium uy': 'Новый дом премиум-класса',
  '3 xonali yorug‘ kvartira': 'Светлая 3-комнатная квартира',
  'Keng hovlili xususiy uy': 'Просторный частный дом с двором',
  'Hovlili uy, tayyor holatda': 'Готовый дом с двором',
  '2 xonali kvartira': '2-комнатная квартира',
  'Tijorat uchun qulay bino': 'Коммерческое помещение',
}

const copy = {
  uz: {
    catalog: 'E’lonlar', sub: 'Sizga mos ko‘chmas mulkni toping', sale: 'Sotuv', rent: 'Ijara', daily: 'Kunlik', all: 'Barchasi', filters: 'Filtrlar', clear: 'Tozalash', district: 'Tuman', districtAll: 'Barcha tumanlar', type: 'Mulk turi', typeAll: 'Barcha turlar', rooms: 'Xonalar', any: 'Istalgan', price: 'Narx', min: 'dan', max: 'gacha', owner: 'Egadan', mortgage: 'Ipotekaga mumkin', verified: 'Tasdiqlangan', search: 'Qidirish', found: 'ta e’lon', sort: 'Saralash', newest: 'Eng yangi', low: 'Arzonidan', high: 'Qimmatidan', map: 'Xarita', openMap: 'Xaritada ko‘rish', details: 'Batafsil', close: 'Yopish', home: 'Bosh sahifa', apartment: 'Kvartira', house: 'Xususiy uy', newBuilding: 'Yangi bino', commercial: 'Tijorat', land: 'Yer', floor: 'qavat', seller: 'Sotuvchi', verifiedSeller: 'Tasdiqlangan sotuvchi', loading: 'Yuklanmoqda...', noResults: 'E’lon topilmadi', noResultsText: 'Filtrlarni o‘zgartirib qayta urinib ko‘ring.', reset: 'Filtrlarni tozalash', priceUnit: 'so‘m', usd: 'у.е.', apply: 'Qo‘llash', mobileFilters: 'Filtrlarni ochish', allListings: 'Barcha e’lonlar', featured: 'TOP', safe: 'Xavfsiz bitim', safeText: 'Tasdiqlangan e’lonlar va sotuvchilar.'
  },
  ru: {
    catalog: 'Объявления', sub: 'Найдите подходящую недвижимость', sale: 'Продажа', rent: 'Аренда', daily: 'Посуточно', all: 'Все', filters: 'Фильтры', clear: 'Сбросить', district: 'Район', districtAll: 'Все районы', type: 'Тип недвижимости', typeAll: 'Все типы', rooms: 'Комнаты', any: 'Любое', price: 'Цена', min: 'от', max: 'до', owner: 'От владельца', mortgage: 'Ипотека доступна', verified: 'Проверено', search: 'Найти', found: 'объявлений', sort: 'Сортировка', newest: 'Новые', low: 'Сначала дешевле', high: 'Сначала дороже', map: 'Карта', openMap: 'Смотреть на карте', details: 'Подробнее', close: 'Закрыть', home: 'Главная', apartment: 'Квартира', house: 'Частный дом', newBuilding: 'Новостройка', commercial: 'Коммерция', land: 'Земля', floor: 'этаж', seller: 'Продавец', verifiedSeller: 'Проверенный продавец', loading: 'Загрузка...', noResults: 'Объявлений не найдено', noResultsText: 'Измените фильтры и попробуйте снова.', reset: 'Сбросить фильтры', priceUnit: 'сум', usd: 'у.е.', apply: 'Применить', mobileFilters: 'Открыть фильтры', allListings: 'Все объявления', featured: 'TOP', safe: 'Безопасная сделка', safeText: 'Проверенные объявления и продавцы.'
  }
}

type IconName = 'search' | 'filter' | 'heart' | 'check' | 'map' | 'home' | 'close' | 'chevron' | 'grid'
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
  if (name === 'filter') return <svg {...common}><path d="M4 5h16M7 12h10M10 19h4"/></svg>
  if (name === 'heart') return <svg {...common}><path d="M20.8 8.8c0 5-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.8A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.6Z"/></svg>
  if (name === 'check') return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>
  if (name === 'map') return <svg {...common}><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/></svg>
  if (name === 'home') return <svg {...common}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>
  if (name === 'close') return <svg {...common}><path d="m6 6 12 12M18 6 6 18"/></svg>
  if (name === 'grid') return <svg {...common}><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></svg>
  return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>
}

const money = (value: number, currency: string, lang: Lang) => `${new Intl.NumberFormat('ru-RU').format(value)} ${currency === 'USD' ? (lang === 'ru' ? 'у.е.' : 'у.е.') : (lang === 'ru' ? 'сум' : 'so‘m')}`

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
  const [mobileFilters, setMobileFilters] = useState(false)
  const [selected, setSelected] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)

  const text = copy[lang]

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
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('listings').select('*, listing_images(image_url,sort_order)').eq('status', 'active')
        if (error) throw error
        if (mounted && data?.length) {
          setListings(data.map((row: any) => ({ ...row, image_url: row.listing_images?.slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))?.[0]?.image_url })))
        }
      } catch {
        // Keep demo listings if the database is unavailable.
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [])

  const districts = useMemo(() => Array.from(new Set(listings.map(x => x.district).filter(Boolean) as string[])).sort(), [listings])
  const filtered = useMemo(() => {
    const min = Number(minPrice.replace(/\s/g, '')) || 0
    const max = Number(maxPrice.replace(/\s/g, '')) || Number.POSITIVE_INFINITY
    return listings.filter(x => tab === 'all' || x.listing_type === tab)
      .filter(x => !district || x.district === district)
      .filter(x => !type || x.property_type === type)
      .filter(x => !rooms || (x.rooms ?? 0) >= Number(rooms))
      .filter(x => x.price >= min && x.price <= max)
      .filter(x => !mortgage || x.is_mortgage_available)
      .filter(x => !owner || x.seller_type === 'owner')
      .filter(x => !verified || x.is_verified)
      .sort((a, b) => sort === 'priceLow' ? a.price - b.price : sort === 'priceHigh' ? b.price - a.price : new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime())
  }, [listings, tab, district, type, rooms, minPrice, maxPrice, mortgage, owner, verified, sort])

  const clearFilters = () => { setTab('sale'); setDistrict(''); setType(''); setRooms(''); setMinPrice(''); setMaxPrice(''); setMortgage(false); setOwner(false); setVerified(false); setSort('newest') }
  const title = (item: Listing) => lang === 'ru' ? (ruTitles[item.title] || item.title) : item.title
  const propertyLabel = (item: Listing) => item.property_type === 'apartment' ? text.apartment : item.property_type === 'house' ? text.house : item.property_type === 'new_building' ? text.newBuilding : item.property_type === 'commercial' ? text.commercial : text.land

  const Filters = ({ mobile = false }: { mobile?: boolean }) => <div className="space-y-5">
    <div className="flex items-center justify-between"><h2 className="text-base font-extrabold">{text.filters}</h2><button onClick={clearFilters} className="text-xs font-bold text-emerald-600 hover:underline">{text.clear}</button></div>
    <label className="block text-sm font-semibold">{text.district}<select value={district} onChange={e => setDistrict(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"><option value="">{text.districtAll}</option>{districts.map(d => <option key={d}>{d}</option>)}</select></label>
    <label className="block text-sm font-semibold">{text.type}<select value={type} onChange={e => setType(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"><option value="">{text.typeAll}</option><option value="apartment">{text.apartment}</option><option value="house">{text.house}</option><option value="new_building">{text.newBuilding}</option><option value="commercial">{text.commercial}</option><option value="land">{text.land}</option></select></label>
    <div><p className="text-sm font-semibold">{text.rooms}</p><div className="mt-2 grid grid-cols-4 gap-2">{['1','2','3','4'].map(r => <button key={r} onClick={() => setRooms(rooms === r ? '' : r)} className={`h-10 rounded-lg border text-sm font-semibold ${rooms === r ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>{r === '4' ? '4+' : r}</button>)}</div></div>
    <div><p className="text-sm font-semibold">{text.price}</p><div className="mt-2 grid grid-cols-2 gap-2"><input inputMode="numeric" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder={text.min} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"/><input inputMode="numeric" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder={text.max} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"/></div></div>
    <div className="space-y-3 border-t border-slate-100 pt-4"><label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={owner} onChange={e => setOwner(e.target.checked)} className="h-4 w-4 accent-emerald-500"/>{text.owner}</label><label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={mortgage} onChange={e => setMortgage(e.target.checked)} className="h-4 w-4 accent-emerald-500"/>{text.mortgage}</label><label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="h-4 w-4 accent-emerald-500"/>{text.verified}</label></div>
    {mobile && <button onClick={() => setMobileFilters(false)} className="w-full rounded-xl bg-emerald-500 py-3 font-bold text-white">{text.apply}</button>}
  </div>

  return <main className="min-h-screen bg-[#f6f7f8] text-slate-900">
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-xl font-black tracking-tight"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white"><Icon name="home" size={19}/></span>Pro<span className="text-emerald-500">house</span></Link>
        <nav className="ml-5 hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex"><Link href="/" className="hover:text-emerald-600">{text.home}</Link><span className="text-emerald-600">{text.catalog}</span><a href="/?tab=rent" className="hover:text-emerald-600">{lang === 'uz' ? 'Ijara' : 'Аренда'}</a><a href="/?tab=new" className="hover:text-emerald-600">{lang === 'uz' ? 'Yangi uylar' : 'Новостройки'}</a></nav>
        <div className="ml-auto flex items-center gap-2"><button onClick={() => { const next = lang === 'uz' ? 'ru' : 'uz'; setLang(next); window.localStorage.setItem('prohouse-lang', next) }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">{lang === 'uz' ? 'O‘z / Ru' : 'Ru / O‘z'}</button><span className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm md:inline-flex">⌖ Toshkent</span><button className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 sm:flex"><Icon name="heart"/></button></div>
      </div>
    </header>

    <section className="border-b bg-white"><div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8"><div className="mb-4 flex items-center gap-2 text-xs text-slate-500"><Link href="/" className="hover:text-emerald-600">{text.home}</Link><span>›</span><span>{text.catalog}</span></div><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 className="text-2xl font-black sm:text-3xl">{text.catalog}</h1><p className="mt-1 text-sm text-slate-500">{text.sub}</p></div><button onClick={() => setMobileFilters(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold shadow-sm lg:hidden"><Icon name="filter"/> {text.mobileFilters}</button></div></div></section>

    <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"><button onClick={() => setTab('sale')} className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold ${tab === 'sale' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{text.sale}</button><button onClick={() => setTab('rent')} className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold ${tab === 'rent' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{text.rent}</button><button onClick={() => setTab('daily')} className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold ${tab === 'daily' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{text.daily}</button><button onClick={() => setTab('all')} className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold ${tab === 'all' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{text.all}</button><div className="ml-auto hidden items-center gap-2 pr-2 sm:flex"><Icon name="search" size={17}/><span className="text-sm text-slate-500">Toshkent</span></div></div>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="hidden h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:block"><Filters/></aside>

        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3"><div><strong className="text-base">{filtered.length.toLocaleString('ru-RU')} {text.found}</strong>{loading && <span className="ml-2 text-xs text-slate-400">{text.loading}</span>}</div><label className="flex items-center gap-2 text-sm text-slate-500">{text.sort}<select value={sort} onChange={e => setSort(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 outline-none"><option value="newest">{text.newest}</option><option value="priceLow">{text.low}</option><option value="priceHigh">{text.high}</option></select></label></div>

          {filtered.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100"><Icon name="search"/></div><h2 className="font-bold">{text.noResults}</h2><p className="mt-1 text-sm text-slate-500">{text.noResultsText}</p><button onClick={clearFilters} className="mt-5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white">{text.reset}</button></div> : <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map(item => <article key={item.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <button onClick={() => setSelected(item)} className="block w-full text-left"><div className="relative aspect-[4/3] overflow-hidden bg-slate-100"><img src={item.image_url || fallback[0].image_url} alt={title(item)} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/><div className="absolute left-3 top-3 flex gap-2">{item.is_featured && <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-black text-slate-900">{text.featured}</span>}{item.is_verified && <span className="rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-bold text-emerald-700">✓ {text.verified}</span>}</div><span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm"><Icon name="heart" size={17}/></span></div><div className="p-4"><h2 className="line-clamp-1 text-[17px] font-extrabold">{money(item.price, item.currency, lang)}</h2><p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-800">{title(item)}</p><p className="mt-2 text-xs text-slate-500">⌖ {item.city}{item.district ? `, ${item.district}` : ''}</p><div className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-600"><span className="rounded-md bg-slate-100 px-2 py-1">{propertyLabel(item)}</span>{item.area_m2 && <span className="rounded-md bg-slate-100 px-2 py-1">{item.area_m2} m²</span>}{item.rooms ? <span className="rounded-md bg-slate-100 px-2 py-1">{item.rooms} {lang === 'uz' ? 'xona' : 'комн.'}</span> : null}{item.floor ? <span className="rounded-md bg-slate-100 px-2 py-1">{item.floor}/{item.floors_total} {text.floor}</span> : null}</div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs"><span className="font-semibold text-slate-600">{item.seller_name || text.seller}</span>{item.is_verified && <span className="flex items-center gap-1 font-bold text-emerald-600"><Icon name="check" size={14}/> {text.verifiedSeller}</span>}</div></div></button>
            </article>)}
          </div>}
        </section>

        <aside className="hidden h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-[#e9f0eb] shadow-sm lg:block"><div className="relative h-full overflow-hidden bg-[linear-gradient(140deg,#e9f1eb_0%,#dce9df_100%)]"><div className="absolute inset-0 opacity-60" style={{backgroundImage:'linear-gradient(32deg, transparent 47%, rgba(90,110,95,.15) 48%, transparent 49%), linear-gradient(120deg, transparent 47%, rgba(90,110,95,.12) 48%, transparent 49%)',backgroundSize:'110px 110px'}}/><div className="absolute left-4 top-4 right-4 flex items-center justify-between rounded-xl bg-white/95 px-3 py-2 text-sm font-bold shadow-sm"><span className="flex items-center gap-2"><Icon name="map" size={16}/> {text.map}</span><span className="text-slate-400">Toshkent</span></div>{[[20,25,'860 mln'],[60,19,'1.24 mlrd'],[42,45,'950 mln'],[72,58,'149 000'],[27,70,'90 000']].map(([x,y,label]) => <span key={`${x}-${y}`} className="absolute rounded-full border-2 border-white bg-emerald-500 px-2 py-1 text-[10px] font-extrabold text-white shadow" style={{left:`${x}%`,top:`${y}%`}}>{label}</span>)}<div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/95 p-3 shadow-sm"><p className="text-xs text-slate-500">{filtered.length} {text.found}</p><button className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-bold text-white"><Icon name="map" size={15}/>{text.openMap}</button></div></div></aside>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Icon name="check"/></div><div><h2 className="font-extrabold">{text.safe}</h2><p className="mt-0.5 text-sm text-slate-500">{text.safeText}</p></div><button className="ml-auto hidden rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold sm:block">{text.details} →</button></div></section>
    </div>

    {mobileFilters && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="close" className="absolute inset-0 bg-slate-900/45" onClick={() => setMobileFilters(false)}/><div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><strong className="text-lg">{text.filters}</strong><button onClick={() => setMobileFilters(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100"><Icon name="close"/></button></div><Filters mobile/></div></div>}

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button aria-label="close" className="absolute inset-0 bg-slate-900/60" onClick={() => setSelected(null)}/><div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><button onClick={() => setSelected(null)} className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow"><Icon name="close"/></button><div className="grid md:grid-cols-2"><img src={selected.image_url || fallback[0].image_url} alt={title(selected)} className="h-64 w-full object-cover md:h-full md:min-h-[430px]"/><div className="p-6 sm:p-8"><div className="flex gap-2">{selected.is_featured && <span className="rounded-lg bg-amber-400 px-2 py-1 text-xs font-black">{text.featured}</span>}{selected.is_verified && <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">✓ {text.verified}</span>}</div><h2 className="mt-4 text-2xl font-black">{money(selected.price, selected.currency, lang)}</h2><p className="mt-2 text-lg font-bold">{title(selected)}</p><p className="mt-3 text-sm text-slate-500">⌖ {selected.city}{selected.district ? `, ${selected.district}` : ''}</p><div className="mt-5 grid grid-cols-2 gap-2 text-sm">{selected.area_m2 && <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-400">Maydon</span><b>{selected.area_m2} m²</b></div>}{selected.rooms && <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-400">{text.rooms}</span><b>{selected.rooms}</b></div>}{selected.floor && <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-400">{text.floor}</span><b>{selected.floor}/{selected.floors_total}</b></div>}<div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-400">{text.type}</span><b>{propertyLabel(selected)}</b></div></div><div className="mt-5 rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-400">{text.seller}</p><p className="mt-1 font-bold">{selected.seller_name || text.seller}</p></div><button onClick={() => setSelected(null)} className="mt-6 w-full rounded-xl bg-emerald-500 py-3.5 font-bold text-white">{text.close}</button></div></div></div></div>}
  </main>
}
