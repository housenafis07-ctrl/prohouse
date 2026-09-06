'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'

type Lang = 'uz' | 'ru'
type Tab = 'sale' | 'rent' | 'daily' | 'all'

type Listing = {
  id: string
  title: string
  title_ru?: string | null
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
  listing_images?: { image_url: string; sort_order: number | null }[]
}

const demo: Listing[] = [
  {
    id: '1', title: '2 xonali zamonaviy kvartira', listing_type: 'sale', property_type: 'apartment',
    price: 860000000, currency: 'UZS', area_m2: 58, rooms: 2, floor: 5, floors_total: 9,
    district: 'Yunusobod', city: 'Toshkent', latitude: 41.365, longitude: 69.287,
    seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: true, is_verified: true,
    is_featured: true, published_at: '2026-09-04T10:00:00Z',
  },
  {
    id: '2', title: 'Yangi qurilgan premium uy', listing_type: 'sale', property_type: 'new_building',
    price: 1240000000, currency: 'UZS', area_m2: 120, rooms: 4, floor: 2, floors_total: 2,
    district: 'Mirzo Ulug‘bek', city: 'Toshkent', latitude: 41.313, longitude: 69.327,
    seller_type: 'developer', seller_name: 'Prohouse Developer', is_mortgage_available: true, is_verified: true,
    is_featured: true, published_at: '2026-09-03T12:00:00Z',
  },
  {
    id: '3', title: '3 xonali yorug‘ kvartira', listing_type: 'sale', property_type: 'apartment',
    price: 950000000, currency: 'UZS', area_m2: 72, rooms: 3, floor: 7, floors_total: 12,
    district: 'Chilonzor', city: 'Toshkent', latitude: 41.278, longitude: 69.203,
    seller_type: 'owner', seller_name: 'Sotuvchi', is_mortgage_available: true, is_verified: true,
    is_featured: true, published_at: '2026-09-02T09:00:00Z',
  },
]

const normalize = (value: string) =>
  value.toLowerCase().replace(/[ʻʼ`’']/g, '').replace(/ tumani/g, '').replace(/ shahar/g, '').trim()

const money = (value: number, currency: string) =>
  `${new Intl.NumberFormat('ru-RU').format(value)} ${currency === 'USD' ? '$' : 'so‘m'}`

const titleOf = (item: Listing, lang: Lang) =>
  lang === 'ru' ? item.title_ru || item.title : item.title

const regionOf = (item: Listing) => {
  if (item.city === 'Toshkent' || item.city === 'Ташкент') return 'Toshkent shahri'
  const district = normalize(item.district || '')
  return (
    UZBEKISTAN_LOCATIONS.find((region) =>
      region.districts.some((name) => {
        const normalized = normalize(name)
        return normalized === district || normalized.includes(district) || district.includes(normalized)
      }),
    )?.name || ''
  )
}

function ListingsMap({ items, lang }: { items: Listing[]; lang: Lang }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const scriptId = 'prohouse-leaflet-listings'
    const init = () => setReady(true)

    if ((window as any).L) {
      init()
      return
    }

    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', init)
      return () => existing.removeEventListener('load', init)
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = init
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (!ready) return

    const L = (window as any).L
    const element = document.getElementById('prohouse-listings-map')
    if (!element) return

    const css = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    if (!document.querySelector(`link[href="${css}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = css
      document.head.appendChild(link)
    }

    const map = L.map(element).setView([41.2995, 69.2401], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const valid = items.filter(
      (item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)),
    )
    const points: [number, number][] = []

    valid.forEach((item) => {
      const point: [number, number] = [Number(item.latitude), Number(item.longitude)]
      points.push(point)

      const formatted = new Intl.NumberFormat('ru-RU', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(item.price)
      const suffix = item.currency === 'USD' ? '$' : 'so‘m'
      const period = item.listing_type === 'rent' ? '/oy' : item.listing_type === 'daily' ? '/kun' : ''

      const marker = L.marker(point, {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:#10b981;color:#fff;border:2px solid #fff;border-radius:999px;padding:7px 11px;box-shadow:0 3px 12px rgba(0,0,0,.2);font-size:12px;font-weight:800;white-space:nowrap">${formatted} ${suffix}${period}</div>`,
          iconAnchor: [18, 18],
        }),
      }).addTo(map)

      marker.bindPopup(
        `<b>${money(item.price, item.currency)} ${period}</b><br/>${titleOf(item, lang)}<br/><a href="/listings/${item.id}" style="color:#059669;font-weight:700">${lang === 'ru' ? 'Открыть объявление' : 'E’lonni ochish'} →</a>`,
      )
    })

    if (points.length === 1) map.setView(points[0], 14)
    if (points.length > 1) map.fitBounds(points, { padding: [24, 24], maxZoom: 14 })

    const timer = window.setTimeout(() => map.invalidateSize(), 100)
    return () => {
      window.clearTimeout(timer)
      map.remove()
    }
  }, [ready, items, lang])

  return <div id="prohouse-listings-map" className="h-[620px] w-full rounded-xl bg-slate-100" />
}

export default function ListingsPage() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('uz')
  const [items, setItems] = useState<Listing[]>(demo)
  const [tab, setTab] = useState<Tab>('sale')
  const [region, setRegion] = useState('')
  const [district, setDistrict] = useState('')
  const [type, setType] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [currency, setCurrency] = useState('')
  const [rooms, setRooms] = useState('')
  const [verified, setVerified] = useState(false)
  const [owner, setOwner] = useState(false)
  const [mortgage, setMortgage] = useState(false)
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('prohouse-lang')
    if (saved === 'ru') setLang('ru')

    const query = new URLSearchParams(window.location.search)
    const queryTab = query.get('tab')
    if (queryTab === 'sale' || queryTab === 'rent' || queryTab === 'daily' || queryTab === 'all') {
      setTab(queryTab)
    }
    setRegion(query.get('region') || '')
    setDistrict(query.get('district') || '')
    setType(query.get('type') || '')
    setMin(query.get('min') || '')
    setMax(query.get('max') || '')
    setCurrency(query.get('currency') || '')
    setVerified(query.get('verified') === 'true')
    setOwner(query.get('owner') === 'true')
    setMortgage(query.get('mortgage') === 'true')

    const loadListings = async () => {
      try {
        const db = createClient()
        const { data, error } = await db
          .from('listings')
          .select('*, listing_images(image_url,sort_order)')
          .eq('status', 'active')
        if (!error && data?.length) setItems(data as Listing[])
      } catch {
        // Keep demo data if Supabase is unavailable.
      } finally {
        setLoading(false)
      }
    }

    loadListings()
  }, [])

  const districts = useMemo(
    () => (region ? UZBEKISTAN_LOCATIONS.find((item) => item.name === region)?.districts ?? [] : []),
    [region],
  )

  const filtered = useMemo(() => {
    const minPrice = min === '' ? 0 : Number(min)
    const maxPrice = max === '' ? Infinity : Number(max)

    return items
      .filter((item) => tab === 'all' || item.listing_type === tab)
      .filter((item) => !region || regionOf(item) === region)
      .filter((item) => !district || normalize(item.district || '') === normalize(district))
      .filter((item) => !type || item.property_type === type)
      .filter((item) => !rooms || (item.rooms ?? 0) >= Number(rooms))
      .filter((item) => !currency || item.currency === currency)
      .filter((item) => Number.isFinite(item.price) && item.price >= minPrice && item.price <= maxPrice)
      .filter((item) => !verified || item.is_verified)
      .filter((item) => !owner || item.seller_type === 'owner')
      .filter((item) => !mortgage || item.is_mortgage_available)
      .sort((a, b) => {
        if (sort === 'priceLow') return a.price - b.price
        if (sort === 'priceHigh') return b.price - a.price
        return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()
      })
  }, [items, tab, region, district, type, min, max, currency, rooms, verified, owner, mortgage, sort])

  const pushFilters = () => {
    const query = new URLSearchParams()
    query.set('tab', tab)
    if (region) query.set('region', region)
    if (district) query.set('district', district)
    if (type) query.set('type', type)
    if (min) query.set('min', min)
    if (max) query.set('max', max)
    if (currency) query.set('currency', currency)
    if (rooms) query.set('rooms', rooms)
    if (verified) query.set('verified', 'true')
    if (owner) query.set('owner', 'true')
    if (mortgage) query.set('mortgage', 'true')
    router.push(`/listings?${query.toString()}`)
  }

  const clear = () => {
    setTab('sale')
    setRegion('')
    setDistrict('')
    setType('')
    setMin('')
    setMax('')
    setCurrency('')
    setRooms('')
    setVerified(false)
    setOwner(false)
    setMortgage(false)
    setSort('newest')
    router.push('/listings?tab=sale')
  }

  const typeLabel = (value: string) => {
    const labels: Record<string, string> = {
      apartment: lang === 'ru' ? 'Квартира' : 'Kvartira',
      house: lang === 'ru' ? 'Частный дом' : 'Xususiy uy',
      new_building: lang === 'ru' ? 'Новостройка' : 'Yangi bino',
      commercial: lang === 'ru' ? 'Коммерция' : 'Tijorat',
      land: lang === 'ru' ? 'Земля' : 'Yer',
    }
    return labels[value] || value
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: 'sale', label: lang === 'ru' ? 'Продажа' : 'Sotuv' },
    { value: 'rent', label: lang === 'ru' ? 'Аренда' : 'Ijara' },
    { value: 'daily', label: lang === 'ru' ? 'Посуточно' : 'Kunlik' },
    { value: 'all', label: lang === 'ru' ? 'Все' : 'Barchasi' },
  ]

  return (
    <main className="min-h-screen bg-[#f6f7f8] text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4">
          <Link href="/" className="text-xl font-black">Pro<span className="text-emerald-500">house</span></Link>
          <button
            onClick={() => {
              const next = lang === 'uz' ? 'ru' : 'uz'
              setLang(next)
              localStorage.setItem('prohouse-lang', next)
            }}
            className="rounded-xl border px-3 py-2 text-xs font-bold"
          >
            {lang === 'uz' ? 'O‘z / Ru' : 'Ru / O‘z'}
          </button>
        </div>
      </header>

      <section className="border-b bg-white">
        <div className="mx-auto max-w-[1440px] px-4 py-6">
          <Link href="/" className="text-xs text-slate-500">{lang === 'ru' ? 'Главная' : 'Bosh sahifa'}</Link>
          <h1 className="mt-3 text-3xl font-black">{lang === 'ru' ? 'Объявления' : 'E’lonlar'}</h1>
          <p className="mt-1 text-sm text-slate-500">{lang === 'ru' ? 'Найдите подходящую недвижимость' : 'Sizga mos ko‘chmas mulkni toping'}</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 py-5">
        <div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border bg-white p-1.5 shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.value}
              onClick={() => {
                setTab(item.value)
                router.push(`/listings?tab=${item.value}`)
              }}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold ${tab === item.value ? 'bg-emerald-500 text-white' : 'text-slate-600'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
          <aside className="h-fit rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-5 flex justify-between">
              <b>{lang === 'ru' ? 'Фильтры' : 'Filtrlar'}</b>
              <button onClick={clear} className="text-xs font-bold text-emerald-600">{lang === 'ru' ? 'Сбросить' : 'Tozalash'}</button>
            </div>

            <label className="block text-sm font-semibold">
              {lang === 'ru' ? 'Расположение' : 'Joylashuv'}
              <select value={region} onChange={(event) => { setRegion(event.target.value); setDistrict('') }} className="mt-2 h-11 w-full rounded-xl border px-3">
                <option value="">{lang === 'ru' ? 'Весь Узбекистан' : 'Butun O‘zbekiston'}</option>
                {UZBEKISTAN_LOCATIONS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </select>
            </label>

            <label className="mt-4 block text-sm font-semibold">
              {lang === 'ru' ? 'Район / город' : 'Tuman / shahar'}
              <select disabled={!region} value={district} onChange={(event) => setDistrict(event.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 disabled:bg-slate-100">
                <option value="">{lang === 'ru' ? 'Все районы и города' : 'Barcha tuman va shaharlar'}</option>
                {districts.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label className="mt-4 block text-sm font-semibold">
              {lang === 'ru' ? 'Тип недвижимости' : 'Ko‘chmas mulk turi'}
              <select value={type} onChange={(event) => setType(event.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3">
                <option value="">{lang === 'ru' ? 'Все типы' : 'Barcha turlar'}</option>
                <option value="apartment">{typeLabel('apartment')}</option>
                <option value="house">{typeLabel('house')}</option>
                <option value="land">{typeLabel('land')}</option>
                <option value="commercial">{typeLabel('commercial')}</option>
                <option value="new_building">{typeLabel('new_building')}</option>
              </select>
            </label>

            <div className="mt-4">
              <p className="text-sm font-semibold">{lang === 'ru' ? 'Валюта' : 'Valyuta'}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { value: '', label: 'All' },
                  { value: 'UZS', label: 'so‘m' },
                  { value: 'USD', label: '$' },
                ].map((item) => (
                  <button key={item.value || 'all'} onClick={() => setCurrency(item.value)} className={`rounded-lg border px-2 py-2 text-xs font-bold ${currency === item.value ? 'border-emerald-500 bg-emerald-50' : ''}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <input value={min} onChange={(event) => setMin(event.target.value)} inputMode="numeric" placeholder={lang === 'ru' ? 'от' : 'dan'} className="h-11 rounded-xl border px-3" />
              <input value={max} onChange={(event) => setMax(event.target.value)} inputMode="numeric" placeholder={lang === 'ru' ? 'до' : 'gacha'} className="h-11 rounded-xl border px-3" />
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold">{lang === 'ru' ? 'Комнаты' : 'Xonalar'}</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {['1', '2', '3', '4'].map((value) => (
                  <button key={value} onClick={() => setRooms(rooms === value ? '' : value)} className={`rounded-lg border py-2 text-sm font-bold ${rooms === value ? 'border-emerald-500 bg-emerald-50' : ''}`}>
                    {value === '4' ? '4+' : value}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t pt-4 text-sm">
              <label className="flex gap-3"><input type="checkbox" checked={owner} onChange={(event) => setOwner(event.target.checked)} />{lang === 'ru' ? 'От владельца' : 'Egadan'}</label>
              <label className="flex gap-3"><input type="checkbox" checked={mortgage} onChange={(event) => setMortgage(event.target.checked)} />{lang === 'ru' ? 'Ипотека доступна' : 'Ipotekaga mumkin'}</label>
              <label className="flex gap-3"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />{lang === 'ru' ? 'Проверено' : 'Tasdiqlangan'}</label>
            </div>

            <button onClick={pushFilters} className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white">
              {lang === 'ru' ? 'Применить' : 'Qo‘llash'}
            </button>
          </aside>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <b>{filtered.length} {lang === 'ru' ? 'объявлений' : 'ta e’lon'}</b>
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm">
                <option value="newest">{lang === 'ru' ? 'Новые' : 'Eng yangi'}</option>
                <option value="priceLow">{lang === 'ru' ? 'Дешевле' : 'Arzonidan'}</option>
                <option value="priceHigh">{lang === 'ru' ? 'Дороже' : 'Qimmatidan'}</option>
              </select>
            </div>

            {loading && <p className="mb-3 text-xs text-slate-400">{lang === 'ru' ? 'Загрузка...' : 'Yuklanmoqda...'}</p>}
            {!loading && filtered.length === 0 && (
              <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">
                {lang === 'ru' ? 'По вашему запросу объявлений нет.' : 'Tanlangan shartlar bo‘yicha e’lon topilmadi.'}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((item) => {
                const image = item.listing_images?.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.image_url
                const period = item.listing_type === 'rent' ? ' / oy' : item.listing_type === 'daily' ? ' / kun' : ''

                return (
                  <Link key={item.id} href={`/listings/${item.id}`} className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                      {image ? <img src={image} alt={titleOf(item, lang)} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-slate-400">Rasm yo‘q</div>}
                      {item.is_featured && <span className="absolute left-3 top-3 rounded-lg bg-amber-400 px-2 py-1 text-xs font-black">TOP</span>}
                      {item.is_verified && <span className="absolute right-3 top-3 rounded-lg bg-white px-2 py-1 text-xs font-bold text-emerald-700">✓ {lang === 'ru' ? 'Проверено' : 'Tasdiqlangan'}</span>}
                    </div>
                    <div className="p-4">
                      <h2 className="text-lg font-black">{money(item.price, item.currency)}{period}</h2>
                      <p className="mt-1 line-clamp-2 text-sm font-bold">{titleOf(item, lang)}</p>
                      <p className="mt-2 text-xs text-slate-500">⌖ {item.city}{item.district ? `, ${item.district}` : ''}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                        <span className="rounded-md bg-slate-100 px-2 py-1">{typeLabel(item.property_type)}</span>
                        {item.area_m2 != null && <span className="rounded-md bg-slate-100 px-2 py-1">{item.area_m2} m²</span>}
                        {item.rooms != null && <span className="rounded-md bg-slate-100 px-2 py-1">{item.rooms} {lang === 'ru' ? 'комн.' : 'xona'}</span>}
                      </div>
                      <div className="mt-4 border-t pt-3 text-xs font-semibold text-slate-600">{item.seller_name || (lang === 'ru' ? 'Продавец' : 'Sotuvchi')}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          <aside className="hidden overflow-hidden rounded-2xl border bg-white p-2 shadow-sm lg:block">
            <ListingsMap items={filtered} lang={lang} />
          </aside>
        </div>
      </div>
    </main>
  )
}
