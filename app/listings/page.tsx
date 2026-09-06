'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

type ListingImage = {
  image_url: string
  sort_order: number | null
}

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

const demo: Listing[] = [
  {
    id: '1',
    title: '2 xonali zamonaviy kvartira',
    listing_type: 'sale',
    property_type: 'apartment',
    price: 860000000,
    currency: 'UZS',
    area_m2: 58,
    rooms: 2,
    floor: 5,
    floors_total: 9,
    district: 'Yunusobod',
    city: 'Toshkent',
    latitude: 41.365,
    longitude: 69.287,
    seller_type: 'owner',
    seller_name: 'Sotuvchi',
    is_mortgage_available: true,
    is_verified: true,
    is_featured: true,
    published_at: '2026-09-04T10:00:00Z',
  },
  {
    id: '2',
    title: 'Yangi qurilgan premium uy',
    listing_type: 'sale',
    property_type: 'new_building',
    price: 1240000000,
    currency: 'UZS',
    area_m2: 120,
    rooms: 4,
    floor: 2,
    floors_total: 2,
    district: 'Mirzo Ulug‘bek',
    city: 'Toshkent',
    latitude: 41.313,
    longitude: 69.327,
    seller_type: 'developer',
    seller_name: 'Prohouse Developer',
    is_mortgage_available: true,
    is_verified: true,
    is_featured: true,
    published_at: '2026-09-03T12:00:00Z',
  },
  {
    id: '3',
    title: '3 xonali yorug‘ kvartira',
    listing_type: 'sale',
    property_type: 'apartment',
    price: 950000000,
    currency: 'UZS',
    area_m2: 72,
    rooms: 3,
    floor: 7,
    floors_total: 12,
    district: 'Chilonzor',
    city: 'Toshkent',
    latitude: 41.278,
    longitude: 69.203,
    seller_type: 'owner',
    seller_name: 'Sotuvchi',
    is_mortgage_available: true,
    is_verified: true,
    is_featured: true,
    published_at: '2026-09-02T09:00:00Z',
  },
]

const money = (value: number, currency: string) =>
  `${new Intl.NumberFormat('ru-RU').format(value)} ${currency === 'USD' ? 'у.е.' : 'so‘m'}`

const titleOf = (item: Listing, lang: 'uz' | 'ru') =>
  lang === 'ru' ? item.title_ru || item.title : item.title

function ListingsMap({ items }: { items: Listing[] }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const scriptId = 'prohouse-leaflet-listings'
    const init = () => setReady(true)

    if ((window as any).L) {
      init()
    } else {
      const existing = document.getElementById(scriptId) as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener('load', init)
      } else {
        const script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.async = true
        script.onload = init
        document.body.appendChild(script)
      }
    }

    return () => {
      document.getElementById(scriptId)?.removeEventListener('load', init)
    }
  }, [])

  useEffect(() => {
    if (!ready || !(window as any).L) return

    const L = (window as any).L
    const element = document.getElementById('prohouse-listings-map')
    if (!element) return

    const cssUrl = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    if (!document.querySelector(`link[href="${cssUrl}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = cssUrl
      document.head.appendChild(link)
    }

    const valid = items.filter(
      (item) => item.latitude != null && item.longitude != null,
    )

    const map = L.map(element).setView(
      valid.length ? [valid[0].latitude, valid[0].longitude] : [41.2995, 69.2401],
      valid.length ? 11 : 10,
    )

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    valid.forEach((item) => {
      L.marker([item.latitude, item.longitude])
        .addTo(map)
        .bindPopup(`<b>${money(item.price, item.currency)}</b><br/>${item.title}`)
    })

    setTimeout(() => map.invalidateSize(), 100)
    return () => map.remove()
  }, [ready, items])

  return (
    <div
      id="prohouse-listings-map"
      className="h-[620px] w-full rounded-2xl bg-slate-100"
    />
  )
}

function ListingCard({ item, lang }: { item: Listing; lang: 'uz' | 'ru' }) {
  const image = item.listing_images
    ?.slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.image_url

  return (
    <Link
      href={`/listings/${item.id}`}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {image ? (
          <img
            src={image}
            alt={titleOf(item, lang)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            {lang === 'ru' ? 'Нет фото' : 'Rasm yo‘q'}
          </div>
        )}

        {item.is_featured ? (
          <span className="absolute left-3 top-3 rounded-lg bg-amber-400 px-2 py-1 text-xs font-black">
            TOP
          </span>
        ) : null}

        {item.is_verified ? (
          <span className="absolute right-3 top-3 rounded-lg bg-white px-2 py-1 text-xs font-bold text-emerald-700">
            ✓ {lang === 'ru' ? 'Проверено' : 'Tasdiqlangan'}
          </span>
        ) : null}
      </div>

      <div className="p-4">
        <h2 className="text-lg font-black">{money(item.price, item.currency)}</h2>
        <p className="mt-1 line-clamp-2 text-sm font-bold">{titleOf(item, lang)}</p>
        <p className="mt-2 text-xs text-slate-500">
          ⌖ {item.city}
          {item.district ? `, ${item.district}` : ''}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-md bg-slate-100 px-2 py-1">
            {item.property_type}
          </span>
          {item.area_m2 != null ? (
            <span className="rounded-md bg-slate-100 px-2 py-1">
              {item.area_m2} m²
            </span>
          ) : null}
          {item.rooms != null ? (
            <span className="rounded-md bg-slate-100 px-2 py-1">
              {item.rooms} {lang === 'ru' ? 'комн.' : 'xona'}
            </span>
          ) : null}
        </div>

        <div className="mt-4 border-t pt-3 text-xs font-semibold text-slate-600">
          {item.seller_name || (lang === 'ru' ? 'Продавец' : 'Sotuvchi')}
        </div>
      </div>
    </Link>
  )
}

export default function ListingsPage() {
  const [lang, setLang] = useState<'uz' | 'ru'>('uz')
  const [items, setItems] = useState<Listing[]>(demo)
  const [tab, setTab] = useState('sale')
  const [district, setDistrict] = useState('')
  const [type, setType] = useState('')
  const [rooms, setRooms] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [verified, setVerified] = useState(false)
  const [owner, setOwner] = useState(false)
  const [mortgage, setMortgage] = useState(false)
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('prohouse-lang')
    if (saved === 'ru') setLang('ru')

    let mounted = true

    const load = async () => {
      try {
        const db = createClient()
        const { data, error } = await db
          .from('listings')
          .select('*, listing_images(image_url,sort_order)')
          .eq('status', 'active')

        if (error) throw error
        if (mounted && data?.length) setItems(data as Listing[])
      } catch {
        // Demo data remains visible if Supabase is temporarily unavailable.
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  const districts = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => item.district).filter(Boolean) as string[]),
      ).sort(),
    [items],
  )

  const filtered = useMemo(() => {
    const minPrice = Number(min) || 0
    const maxPrice = Number(max) || Infinity

    return items
      .filter((item) => tab === 'all' || item.listing_type === tab)
      .filter((item) => !district || item.district === district)
      .filter((item) => !type || item.property_type === type)
      .filter((item) => !rooms || (item.rooms ?? 0) >= Number(rooms))
      .filter((item) => item.price >= minPrice && item.price <= maxPrice)
      .filter((item) => !verified || item.is_verified)
      .filter((item) => !owner || item.seller_type === 'owner')
      .filter((item) => !mortgage || item.is_mortgage_available)
      .sort((a, b) => {
        if (sort === 'priceLow') return a.price - b.price
        if (sort === 'priceHigh') return b.price - a.price
        return (
          new Date(b.published_at || 0).getTime() -
          new Date(a.published_at || 0).getTime()
        )
      })
  }, [items, tab, district, type, rooms, min, max, verified, owner, mortgage, sort])

  const clear = () => {
    setTab('sale')
    setDistrict('')
    setType('')
    setRooms('')
    setMin('')
    setMax('')
    setVerified(false)
    setOwner(false)
    setMortgage(false)
    setSort('newest')
  }

  const tabs = [
    ['sale', lang === 'ru' ? 'Продажа' : 'Sotuv'],
    ['rent', lang === 'ru' ? 'Аренда' : 'Ijara'],
    ['daily', lang === 'ru' ? 'Посуточно' : 'Kunlik'],
    ['all', lang === 'ru' ? 'Все' : 'Barchasi'],
  ]

  return (
    <main className="min-h-screen bg-[#f6f7f8] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-xl font-black">
            Pro<span className="text-emerald-500">house</span>
          </Link>
          <button
            onClick={() => {
              const next = lang === 'uz' ? 'ru' : 'uz'
              setLang(next)
              localStorage.setItem('prohouse-lang', next)
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
          >
            {lang === 'uz' ? 'O‘z / Ru' : 'Ru / O‘z'}
          </button>
        </div>
      </header>

      <section className="border-b bg-white">
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/" className="text-xs text-slate-500">
            {lang === 'ru' ? 'Главная' : 'Bosh sahifa'}
          </Link>
          <h1 className="mt-3 text-3xl font-black">
            {lang === 'ru' ? 'Объявления' : 'E’lonlar'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {lang === 'ru'
              ? 'Найдите подходящую недвижимость'
              : 'Sizga mos ko‘chmas mulkni toping'}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold ${
                tab === value ? 'bg-emerald-500 text-white' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex justify-between">
              <b>{lang === 'ru' ? 'Фильтры' : 'Filtrlar'}</b>
              <button onClick={clear} className="text-xs font-bold text-emerald-600">
                {lang === 'ru' ? 'Сбросить' : 'Tozalash'}
              </button>
            </div>

            <label className="block text-sm font-semibold">
              {lang === 'ru' ? 'Район' : 'Tuman'}
              <select
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3"
              >
                <option value="">{lang === 'ru' ? 'Все районы' : 'Barcha tumanlar'}</option>
                {districts.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-sm font-semibold">
              {lang === 'ru' ? 'Тип' : 'Mulk turi'}
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3"
              >
                <option value="">{lang === 'ru' ? 'Все типы' : 'Barcha turlar'}</option>
                <option value="apartment">Kvartira</option>
                <option value="house">Xususiy uy</option>
                <option value="new_building">Yangi bino</option>
                <option value="commercial">Tijorat</option>
                <option value="land">Yer</option>
              </select>
            </label>

            <div className="mt-4">
              <p className="text-sm font-semibold">{lang === 'ru' ? 'Комнаты' : 'Xonalar'}</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {['1', '2', '3', '4'].map((value) => (
                  <button
                    key={value}
                    onClick={() => setRooms(rooms === value ? '' : value)}
                    className={`h-10 rounded-lg border text-sm font-bold ${
                      rooms === value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200'
                    }`}
                  >
                    {value === '4' ? '4+' : value}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <input
                value={min}
                onChange={(event) => setMin(event.target.value)}
                inputMode="numeric"
                placeholder={lang === 'ru' ? 'от' : 'dan'}
                className="h-11 rounded-xl border border-slate-200 px-3"
              />
              <input
                value={max}
                onChange={(event) => setMax(event.target.value)}
                inputMode="numeric"
                placeholder={lang === 'ru' ? 'до' : 'gacha'}
                className="h-11 rounded-xl border border-slate-200 px-3"
              />
            </div>

            <div className="mt-5 space-y-3 border-t pt-4 text-sm">
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={owner}
                  onChange={(event) => setOwner(event.target.checked)}
                />
                {lang === 'ru' ? 'От владельца' : 'Egadan'}
              </label>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={mortgage}
                  onChange={(event) => setMortgage(event.target.checked)}
                />
                {lang === 'ru' ? 'Ипотека доступна' : 'Ipotekaga mumkin'}
              </label>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(event) => setVerified(event.target.checked)}
                />
                {lang === 'ru' ? 'Проверено' : 'Tasdiqlangan'}
              </label>
            </div>
          </aside>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <b>
                {filtered.length} {lang === 'ru' ? 'объявлений' : 'ta e’lon'}
              </b>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="newest">{lang === 'ru' ? 'Новые' : 'Eng yangi'}</option>
                <option value="priceLow">{lang === 'ru' ? 'Дешевле' : 'Arzonidan'}</option>
                <option value="priceHigh">{lang === 'ru' ? 'Дороже' : 'Qimmatidan'}</option>
              </select>
            </div>

            {loading ? (
              <p className="mb-3 text-xs text-slate-400">Yuklanmoqda...</p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((item) => (
                <ListingCard key={item.id} item={item} lang={lang} />
              ))}
            </div>
          </section>

          <aside className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:block">
            <ListingsMap items={filtered} />
          </aside>
        </div>
      </div>
    </main>
  )
}
