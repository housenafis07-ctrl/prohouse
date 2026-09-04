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

const ruTitles: Record<string, string> = {
  '2 xonali zamonaviy kvartira': 'Современная 2-комнатная квартира',
  'Yangi qurilgan premium uy': 'Новый дом премиум-класса',
  '3 xonali yorug‘ kvartira': 'Светлая 3-комнатная квартира',
  'Keng hovlili xususiy uy': 'Просторный частный дом с двором',
  'Hovlili uy, tayyor holatda': 'Готовый дом с двором',
  '2 xonali kvartira': '2-комнатная квартира',
  'Tijorat uchun qulay bino': 'Коммерческое помещение',
}

const labels = {
  uz: {
    title: 'Ko‘chmas mulk e’lonlari', sub: 'Sizga mos uy, kvartira yoki tijorat obyektini toping.', sale: 'Sotuv', rent: 'Ijara', daily: 'Kunlik', all: 'Barchasi', search: 'Qidirish', reset: 'Tozalash', filters: 'Filtrlar', district: 'Tuman', type: 'Mulk turi', price: 'Narx', rooms: 'Xonalar', any: 'Barchasi', apartment: 'Kvartira', house: 'Xususiy uy', land: 'Yer', commercial: 'Tijorat', newBuilding: 'Yangi bino', mortgage: 'Ipotekaga mumkin', owner: 'Egadan', verified: 'Tasdiqlangan', found: 'ta e’lon', newest: 'Eng yangi', priceLow: 'Arzonidan', priceHigh: 'Qimmatidan', map: 'Xaritada ko‘rish', home: 'Bosh sahifa', view: 'Ko‘rish', perMonth: '/oyiga', perDay: '/kuniga'
  },
  ru: {
    title: 'Объявления недвижимости', sub: 'Найдите подходящий дом, квартиру или коммерческий объект.', sale: 'Продажа', rent: 'Аренда', daily: 'Посуточно', all: 'Все', search: 'Найти', reset: 'Сбросить', filters: 'Фильтры', district: 'Район', type: 'Тип недвижимости', price: 'Цена', rooms: 'Комнаты', any: 'Все', apartment: 'Квартира', house: 'Частный дом', land: 'Земля', commercial: 'Коммерция', newBuilding: 'Новостройка', mortgage: 'Ипотека', owner: 'От владельца', verified: 'Проверено', found: 'объявлений', newest: 'Новые', priceLow: 'Сначала дешевле', priceHigh: 'Сначала дороже', map: 'Смотреть на карте', home: 'Главная', view: 'Смотреть', perMonth: '/мес.', perDay: '/день'
  }
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

    const supabase = createClient()
    if (!supabase) { setLoading(false); return }

    supabase
      .from('listings')
      .select('*, listing_images(image_url,sort_order)')
      .eq('status', 'active')
      .then(({ data }) => {
        if (data?.length) {
          setListings(data.map((row: any) => ({
            ...row,
            image_url: row.listing_images?.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))?.[0]?.image_url
          })))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
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
    <main className="catalog-page">
      <header className="catalog-header">
        <div className="catalog-container catalog-nav">
          <Link href="/" className="catalog-brand"><span className="catalog-mark">⌂</span>Pro<span>house</span></Link>
          <div className="catalog-nav-links"><Link href="/">{text.home}</Link><a className="active" href="#catalog">{text.title}</a></div>
          <button className="catalog-lang" onClick={() => { const next = lang === 'uz' ? 'ru' : 'uz'; setLang(next); window.localStorage.setItem('prohouse-lang', next) }}>{lang === 'uz' ? 'O‘z / Ru' : 'Ru / O‘z'}</button>
        </div>
      </header>

      <section className="catalog-hero">
        <div className="catalog-container">
          <div className="catalog-breadcrumb"><Link href="/">Prohouse</Link><span>›</span><span>{text.title}</span></div>
          <h1>{text.title}</h1>
          <p>{text.sub}</p>
        </div>
      </section>

      <section className="catalog-container catalog-shell" id="catalog">
        <div className="catalog-tabs">
          {([['sale', text.sale], ['rent', text.rent], ['daily', text.daily], ['all', text.all]] as const).map(([value, label]) => <button key={value} className={tab === value ? 'selected' : ''} onClick={() => setTab(value)}>{label}</button>)}
        </div>

        <div className="filter-layout">
          <aside className="filter-panel">
            <div className="filter-head"><strong>{text.filters}</strong><button onClick={clearFilters}>{text.reset}</button></div>
            <label>{text.district}<select value={district} onChange={e => setDistrict(e.target.value)}><option value="">{text.any}</option>{districts.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
            <label>{text.type}<select value={type} onChange={e => setType(e.target.value)}><option value="">{text.any}</option><option value="apartment">{text.apartment}</option><option value="house">{text.house}</option><option value="land">{text.land}</option><option value="commercial">{text.commercial}</option><option value="new_building">{text.newBuilding}</option></select></label>
            <label>{text.rooms}<select value={rooms} onChange={e => setRooms(e.target.value)}><option value="">{text.any}</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option><option value="5">5+</option></select></label>
            <div className="price-label">{text.price}</div>
            <div className="price-inputs"><input inputMode="numeric" placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} /><input inputMode="numeric" placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} /></div>
            <div className="check-list">
              <label className="check"><input type="checkbox" checked={mortgage} onChange={e => setMortgage(e.target.checked)} /><span>{text.mortgage}</span></label>
              <label className="check"><input type="checkbox" checked={owner} onChange={e => setOwner(e.target.checked)} /><span>{text.owner}</span></label>
              <label className="check"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} /><span>{text.verified}</span></label>
            </div>
            <button className="mobile-search" onClick={() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })}>{text.search}</button>
          </aside>

          <div className="results-area" id="results">
            <div className="results-toolbar"><div><strong>{filtered.length}</strong> {text.found}</div><div className="toolbar-actions"><button>{text.map}</button><select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">{text.newest}</option><option value="priceLow">{text.priceLow}</option><option value="priceHigh">{text.priceHigh}</option></select></div></div>
            {loading && <div className="loading-box">E’lonlar yuklanmoqda...</div>}
            {!loading && filtered.length === 0 && <div className="empty-box"><div>⌂</div><strong>E’lon topilmadi</strong><span>Filtrlarni o‘zgartirib qayta urinib ko‘ring.</span><button onClick={clearFilters}>{text.reset}</button></div>}
            <div className="catalog-grid">
              {filtered.map(item => (
                <article className="catalog-card" key={item.id}>
                  <div className="catalog-image" style={{ backgroundImage: `url(${item.image_url || 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85'})` }}>
                    {item.is_featured && <span className="vip">VIP</span>}
                    {item.is_verified && <span className="verified-badge">✓ {text.verified}</span>}
                    <button className="favorite" aria-label="Saqlash">♡</button>
                  </div>
                  <div className="catalog-card-body">
                    <div className="catalog-price">{money(item.price, item.currency)} <small>{item.listing_type === 'rent' ? text.perMonth : item.listing_type === 'daily' ? text.perDay : ''}</small></div>
                    <h2>{displayTitle(item)}</h2>
                    <p className="catalog-location">⌖ {item.district || item.city}, {item.city}</p>
                    <div className="catalog-meta"><span>{item.area_m2 ?? '—'} m²</span><span>{item.rooms ?? '—'} {text.rooms.toLowerCase()}</span>{item.floor ? <span>{item.floor}/{item.floors_total}</span> : null}</div>
                    <div className="catalog-seller"><span>{item.seller_type === 'owner' ? text.owner : item.seller_name || 'Rieltor'}</span><b>›</b></div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .catalog-page{min-height:100vh;background:#f7f9fa;color:#10232e;font-family:Arial,Helvetica,sans-serif}
        .catalog-container{width:min(1400px,calc(100% - 48px));margin:auto}
        .catalog-header{height:72px;background:#fff;border-bottom:1px solid #e4e9ec;position:sticky;top:0;z-index:20}
        .catalog-nav{height:100%;display:flex;align-items:center;gap:35px}.catalog-brand{display:flex;align-items:center;gap:9px;text-decoration:none;color:#10232e;font-weight:800;font-size:22px;letter-spacing:-1px}.catalog-brand>span:last-child{color:#08ad55}.catalog-mark{width:31px;height:31px;border-radius:9px 9px 9px 3px;background:#08ad55;color:#fff;display:grid;place-items:center;font-size:19px}.catalog-nav-links{display:flex;gap:24px;flex:1}.catalog-nav-links a{font-size:12px;color:#63727b;text-decoration:none}.catalog-nav-links a.active{color:#078b45;font-weight:800}.catalog-lang{border:1px solid #dce4e7;background:#fff;border-radius:9px;padding:9px 12px;font-size:11px;font-weight:800;cursor:pointer}
        .catalog-hero{background:linear-gradient(135deg,#08232d,#123e49);padding:42px 0 50px;color:#fff}.catalog-breadcrumb{display:flex;gap:8px;font-size:11px;color:#a9bdc5;margin-bottom:22px}.catalog-breadcrumb a{color:#51dd91;text-decoration:none}.catalog-hero h1{font-size:40px;letter-spacing:-1.5px;margin:0 0 8px}.catalog-hero p{margin:0;color:#c9d9de;font-size:14px}
        .catalog-shell{margin-top:-22px;background:#fff;border:1px solid #e3e9eb;border-radius:18px;box-shadow:0 15px 45px #0a263312;padding:10px 16px 25px;margin-bottom:55px}.catalog-tabs{display:flex;gap:6px;padding:4px 0 16px}.catalog-tabs button{border:0;background:#f2f5f6;color:#56666f;border-radius:10px;padding:12px 26px;font-size:12px;font-weight:800;cursor:pointer}.catalog-tabs button.selected{background:#08ad55;color:#fff}
        .filter-layout{display:grid;grid-template-columns:250px 1fr;gap:22px}.filter-panel{border:1px solid #e5eaec;border-radius:14px;padding:16px;background:#fbfcfc;height:max-content;position:sticky;top:90px}.filter-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font-size:14px}.filter-head button{border:0;background:none;color:#08a552;font-size:10px;font-weight:800;cursor:pointer}.filter-panel>label:not(.check),.price-label{display:block;font-size:10px;font-weight:800;color:#65757e;margin:15px 0 7px}.filter-panel select,.price-inputs input{width:100%;border:1px solid #dfe6e8;border-radius:9px;background:#fff;padding:10px;font-size:11px;outline:none}.filter-panel select:focus,.price-inputs input:focus{border-color:#08ad55}.price-inputs{display:grid;grid-template-columns:1fr 1fr;gap:7px}.check-list{border-top:1px solid #e8edef;margin-top:18px;padding-top:7px}.check{display:flex!important;align-items:center;gap:8px;margin:11px 0!important;font-size:10px!important;color:#4d5d65!important;font-weight:600!important}.check input{accent-color:#08ad55}.mobile-search{width:100%;border:0;background:#08ad55;color:#fff;border-radius:9px;padding:11px;margin-top:10px;font-size:11px;font-weight:800;cursor:pointer}
        .results-toolbar{display:flex;justify-content:space-between;align-items:center;margin:2px 0 14px;font-size:11px;color:#7a8991}.results-toolbar strong{font-size:18px;color:#10232e}.toolbar-actions{display:flex;gap:7px}.toolbar-actions button,.toolbar-actions select{border:1px solid #dfe6e8;background:#fff;border-radius:8px;padding:8px 10px;font-size:10px;color:#43545d}.catalog-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.catalog-card{background:#fff;border:1px solid #e1e7e9;border-radius:13px;overflow:hidden;box-shadow:0 5px 20px #0a263306}.catalog-image{height:190px;background-size:cover;background-position:center;position:relative}.vip{position:absolute;left:10px;top:10px;background:#ffd526;color:#171717;border-radius:7px;padding:5px 8px;font-size:9px;font-weight:900}.verified-badge{position:absolute;left:10px;bottom:10px;background:#fff;color:#078b45;border-radius:8px;padding:6px 8px;font-size:9px;font-weight:800}.favorite{position:absolute;right:10px;top:10px;border:0;background:#fff;border-radius:50%;width:31px;height:31px;font-size:18px;cursor:pointer}.catalog-card-body{padding:13px}.catalog-price{font-size:18px;font-weight:900;letter-spacing:-.5px}.catalog-price small{font-size:9px;color:#87949a;font-weight:700}.catalog-card h2{font-size:12px;line-height:1.35;margin:7px 0 4px}.catalog-location{font-size:10px;color:#74838b;margin:0 0 10px}.catalog-meta{display:flex;gap:12px;border-top:1px solid #edf0f1;padding-top:9px;font-size:9px;color:#66757d}.catalog-seller{display:flex;justify-content:space-between;align-items:center;margin-top:11px;font-size:9px;color:#4e5e67}.catalog-seller b{font-size:18px;color:#08ad55}.loading-box,.empty-box{border:1px dashed #d8e1e4;border-radius:13px;padding:45px;text-align:center;color:#7b8991;margin-bottom:15px}.empty-box{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-box div{font-size:28px;color:#08ad55}.empty-box strong{color:#253740}.empty-box button{border:0;background:#08ad55;color:#fff;border-radius:8px;padding:9px 14px;font-size:10px;font-weight:800;margin-top:6px}
        @media(max-width:1000px){.filter-layout{grid-template-columns:210px 1fr}.catalog-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.catalog-image{height:175px}}
        @media(max-width:700px){.catalog-container{width:calc(100% - 24px)}.catalog-header{height:64px}.catalog-nav{gap:10px}.catalog-nav-links{display:none}.catalog-lang{margin-left:auto}.catalog-hero{padding:30px 0 42px}.catalog-hero h1{font-size:30px}.catalog-shell{margin-top:-16px;padding:9px;margin-bottom:30px}.catalog-tabs{overflow:auto}.catalog-tabs button{white-space:nowrap;padding:11px 19px}.filter-layout{display:block}.filter-panel{position:relative;top:auto;margin-bottom:17px}.catalog-grid{grid-template-columns:1fr 1fr;gap:9px}.catalog-image{height:145px}.catalog-card-body{padding:10px}.catalog-price{font-size:15px}.catalog-card h2{font-size:11px}.catalog-meta{gap:7px}.results-toolbar{align-items:flex-start;gap:8px}.toolbar-actions{flex-direction:column}.toolbar-actions button{display:none}}
        @media(max-width:470px){.catalog-grid{grid-template-columns:1fr}.catalog-image{height:190px}.catalog-hero h1{font-size:27px}.catalog-shell{border-radius:13px}.price-inputs{grid-template-columns:1fr 1fr}}
      `}</style>
    </main>
  )
}
