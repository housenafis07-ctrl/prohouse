'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Lang = 'uz' | 'ru'
type View = 'grid' | 'list'
type Sort = 'newest' | 'price_asc' | 'price_desc' | 'area_desc'

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
  { id:'1', title:'2 xonali zamonaviy kvartira', listing_type:'sale', property_type:'apartment', price:860000000, currency:'UZS', area_m2:58, rooms:2, floor:5, floors_total:9, district:'Yunusobod', city:'Toshkent', seller_type:'owner', seller_name:'Sotuvchi', is_mortgage_available:true, is_verified:true, is_featured:true, published_at:null, image_url:'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85' },
  { id:'2', title:'Yangi qurilgan premium uy', listing_type:'sale', property_type:'new_building', price:1240000000, currency:'UZS', area_m2:120, rooms:4, floor:2, floors_total:2, district:'Mirzo Ulug‘bek', city:'Toshkent', seller_type:'developer', seller_name:'Rieltor', is_mortgage_available:true, is_verified:true, is_featured:true, published_at:null, image_url:'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85' },
  { id:'3', title:'3 xonali yorug‘ kvartira', listing_type:'sale', property_type:'apartment', price:950000000, currency:'UZS', area_m2:72, rooms:3, floor:7, floors_total:12, district:'Chilonzor', city:'Toshkent', seller_type:'owner', seller_name:'Sotuvchi', is_mortgage_available:true, is_verified:true, is_featured:true, published_at:null, image_url:'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85' },
  { id:'4', title:'Keng hovlili xususiy uy', listing_type:'sale', property_type:'house', price:185000, currency:'USD', area_m2:190, rooms:5, floor:2, floors_total:2, district:'Mirzo Ulug‘bek', city:'Toshkent', seller_type:'owner', seller_name:'Sotuvchi', is_mortgage_available:false, is_verified:true, is_featured:false, published_at:null, image_url:'https://images.unsplash.com/photo-1605146769289-440113cc3d00?auto=format&fit=crop&w=1000&q=85' },
  { id:'5', title:'Hovlili uy, tayyor holatda', listing_type:'sale', property_type:'house', price:149000, currency:'USD', area_m2:200, rooms:5, floor:2, floors_total:2, district:'Sergeli', city:'Toshkent', seller_type:'realtor', seller_name:'Rieltor', is_mortgage_available:false, is_verified:true, is_featured:false, published_at:null, image_url:'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85' },
  { id:'6', title:'2 xonali kvartira', listing_type:'sale', property_type:'apartment', price:90000, currency:'USD', area_m2:64, rooms:2, floor:4, floors_total:9, district:'Yakkasaroy', city:'Toshkent', seller_type:'owner', seller_name:'Sotuvchi', is_mortgage_available:false, is_verified:true, is_featured:false, published_at:null, image_url:'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85' },
  { id:'7', title:'Tijorat uchun qulay bino', listing_type:'sale', property_type:'commercial', price:135000, currency:'USD', area_m2:123, rooms:0, floor:1, floors_total:1, district:'Chilonzor', city:'Toshkent', seller_type:'realtor', seller_name:'Rieltor', is_mortgage_available:false, is_verified:true, is_featured:false, published_at:null, image_url:'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85' },
]

const ruTitles: Record<string,string> = {
  '2 xonali zamonaviy kvartira':'Современная 2-комнатная квартира',
  'Yangi qurilgan premium uy':'Новый дом премиум-класса',
  '3 xonali yorug‘ kvartira':'Светлая 3-комнатная квартира',
  'Keng hovlili xususiy uy':'Просторный частный дом с двором',
  'Hovlili uy, tayyor holatda':'Готовый дом с двором',
  '2 xonali kvartira':'2-комнатная квартира',
  'Tijorat uchun qulay bino':'Коммерческое помещение',
}

const copy = {
  uz: {
    buy:'Sotuv', rent:'Ijara', daily:'Kunlik', new:'Yangi uylar', search:'Qidirish', searchPlaceholder:'Manzil, tuman yoki e’lon nomi', filters:'Filtrlar', reset:'Tozalash', found:'ta e’lon', property:'Ko‘chmas mulk', district:'Tuman', allDistricts:'Barcha tumanlar', type:'Mulk turi', allTypes:'Barcha turlar', price:'Narx', min:'dan', max:'gacha', currency:'Valyuta', rooms:'Xonalar', anyRooms:'Istalgan', owner:'Egasi', mortgage:'Ipotekaga mumkin', verified:'Tasdiqlangan', featured:'TOP e’lonlar', sort:'Saralash', newest:'Yangi qo‘shilganlar', lowPrice:'Arzonidan', highPrice:'Qimmatidan', area:'Maydoni katta', grid:'Setka', list:'Ro‘yxat', map:'Xarita', all:'Barchasi', apartment:'Kvartira', house:'Xususiy uy', land:'Yer uchastkasi', commercial:'Tijorat', newBuilding:'Yangi bino', anyPrice:'Istalgan narx', apply:'Qo‘llash', page:'Sahifa', of:'dan', previous:'← Oldingi', next:'Keyingi →', verifiedSeller:'Tasdiqlangan', noResults:'E’lon topilmadi', noResultsText:'Filtrlarni kengaytirib yoki tozalab qayta urinib ko‘ring.', clearAll:'Filtrlarni tozalash', home:'Bosh sahifa', login:'Kirish', post:'E’lon joylashtirish'
  },
  ru: {
    buy:'Продажа', rent:'Аренда', daily:'Посуточно', new:'Новостройки', search:'Найти', searchPlaceholder:'Адрес, район или название объявления', filters:'Фильтры', reset:'Сбросить', found:'объявлений', property:'Недвижимость', district:'Район', allDistricts:'Все районы', type:'Тип недвижимости', allTypes:'Все типы', price:'Цена', min:'от', max:'до', currency:'Валюта', rooms:'Комнаты', anyRooms:'Любое', owner:'От владельца', mortgage:'Ипотека доступна', verified:'Проверенные', featured:'TOP объявления', sort:'Сортировка', newest:'Новые', lowPrice:'Сначала дешевле', highPrice:'Сначала дороже', area:'Большая площадь', grid:'Сетка', list:'Список', map:'Карта', all:'Все', apartment:'Квартира', house:'Частный дом', land:'Земля', commercial:'Коммерция', newBuilding:'Новостройка', anyPrice:'Любая цена', apply:'Применить', page:'Страница', of:'из', previous:'← Назад', next:'Далее →', verifiedSeller:'Проверено', noResults:'Объявления не найдены', noResultsText:'Расширьте или сбросьте фильтры и попробуйте снова.', clearAll:'Сбросить фильтры', home:'Главная', login:'Войти', post:'Разместить объявление'
  }
}

const formatMoney = (value:number, currency:string) => new Intl.NumberFormat('ru-RU').format(value) + (currency === 'USD' ? ' у.е.' : ' сўм')

export default function PropertiesPage() {
  const [lang,setLang] = useState<Lang>('uz')
  const [listings,setListings] = useState<Listing[]>(fallback)
  const [loading,setLoading] = useState(true)
  const [total,setTotal] = useState(fallback.length)
  const [tab,setTab] = useState('sale')
  const [query,setQuery] = useState('')
  const [district,setDistrict] = useState('')
  const [type,setType] = useState('')
  const [currency,setCurrency] = useState('UZS')
  const [minPrice,setMinPrice] = useState('')
  const [maxPrice,setMaxPrice] = useState('')
  const [rooms,setRooms] = useState('')
  const [owner,setOwner] = useState(false)
  const [mortgage,setMortgage] = useState(false)
  const [verified,setVerified] = useState(false)
  const [featured,setFeatured] = useState(false)
  const [sort,setSort] = useState<Sort>('newest')
  const [page,setPage] = useState(1)
  const [view,setView] = useState<View>('grid')
  const perPage = 9
  const text = copy[lang]

  useEffect(() => {
    const saved = window.localStorage.getItem('prohouse-lang') as Lang | null
    if (saved === 'uz' || saved === 'ru') setLang(saved)
  }, [])

  const districts = useMemo(() => Array.from(new Set(listings.map(x => x.district).filter(Boolean) as string[])).sort(), [listings])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        let builder:any = supabase.from('listings').select('*, listing_images(image_url,sort_order)', { count:'exact' }).eq('status','active')
        if (tab !== 'all') builder = builder.eq('listing_type', tab)
        if (district) builder = builder.eq('district', district)
        if (type) builder = builder.eq('property_type', type)
        if (currency) builder = builder.eq('currency', currency)
        if (minPrice) builder = builder.gte('price', Number(minPrice.replace(/\D/g,'')))
        if (maxPrice) builder = builder.lte('price', Number(maxPrice.replace(/\D/g,'')))
        if (rooms) builder = builder.eq('rooms', Number(rooms))
        if (owner) builder = builder.eq('seller_type','owner')
        if (mortgage) builder = builder.eq('is_mortgage_available',true)
        if (verified) builder = builder.eq('is_verified',true)
        if (featured) builder = builder.eq('is_featured',true)
        if (query.trim()) builder = builder.or(`title.ilike.%${query.trim()}%,district.ilike.%${query.trim()}%,city.ilike.%${query.trim()}%`)
        if (sort === 'price_asc') builder = builder.order('price',{ascending:true})
        else if (sort === 'price_desc') builder = builder.order('price',{ascending:false})
        else if (sort === 'area_desc') builder = builder.order('area_m2',{ascending:false})
        else builder = builder.order('is_featured',{ascending:false}).order('published_at',{ascending:false})
        const from = (page - 1) * perPage
        const { data,count,error } = await builder.range(from,from + perPage - 1)
        if (error) throw error
        if (cancelled) return
        setTotal(count || 0)
        setListings((data || []).map((row:any) => ({ ...row, image_url: row.listing_images?.sort((a:any,b:any)=>a.sort_order-b.sort_order)?.[0]?.image_url })))
      } catch {
        if (cancelled) return
        let filtered = fallback.filter(x => tab === 'all' || x.listing_type === tab)
        if (district) filtered = filtered.filter(x => x.district === district)
        if (type) filtered = filtered.filter(x => x.property_type === type)
        filtered = filtered.filter(x => x.currency === currency)
        if (minPrice) filtered = filtered.filter(x => x.price >= Number(minPrice.replace(/\D/g,'')))
        if (maxPrice) filtered = filtered.filter(x => x.price <= Number(maxPrice.replace(/\D/g,'')))
        if (rooms) filtered = filtered.filter(x => x.rooms === Number(rooms))
        if (owner) filtered = filtered.filter(x => x.seller_type === 'owner')
        if (mortgage) filtered = filtered.filter(x => x.is_mortgage_available)
        if (verified) filtered = filtered.filter(x => x.is_verified)
        if (featured) filtered = filtered.filter(x => x.is_featured)
        if (query.trim()) filtered = filtered.filter(x => `${x.title} ${x.district} ${x.city}`.toLowerCase().includes(query.toLowerCase()))
        if (sort === 'price_asc') filtered.sort((a,b)=>a.price-b.price)
        if (sort === 'price_desc') filtered.sort((a,b)=>b.price-a.price)
        if (sort === 'area_desc') filtered.sort((a,b)=>(b.area_m2||0)-(a.area_m2||0))
        setTotal(filtered.length)
        setListings(filtered.slice((page-1)*perPage,page*perPage))
      } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [tab,district,type,currency,minPrice,maxPrice,rooms,owner,mortgage,verified,featured,sort,page])

  useEffect(() => { setPage(1) }, [tab,district,type,currency,minPrice,maxPrice,rooms,owner,mortgage,verified,featured,sort])

  const changeLanguage = (next:Lang) => { setLang(next); window.localStorage.setItem('prohouse-lang',next) }
  const clearFilters = () => { setQuery(''); setDistrict(''); setType(''); setCurrency('UZS'); setMinPrice(''); setMaxPrice(''); setRooms(''); setOwner(false); setMortgage(false); setVerified(false); setFeatured(false); setSort('newest'); setTab('sale'); setPage(1) }
  const displayTitle = (p:Listing) => lang === 'ru' ? (ruTitles[p.title] || p.title) : p.title
  const pages = Math.max(1,Math.ceil(total/perPage))

  return <main className="catalog-page">
    <header className="header"><div className="container nav">
      <a className="brand" href="/"><span className="brand-mark">⌂</span><span>Pro<span>house</span></span></a>
      <nav className="main-nav"><a className="active" href="/properties">{text.buy}</a><a href="/properties?type=rent">{text.rent}</a><a href="/properties?type=new_building">{text.new}</a><a href="#">Uy qurish</a><a href="#">{lang === 'uz' ? 'Ipoteka' : 'Ипотека'}</a><a href="#">{lang === 'uz' ? 'Xizmatlar' : 'Услуги'}</a></nav>
      <div className="nav-actions"><button className="language-btn" onClick={()=>changeLanguage(lang === 'uz' ? 'ru' : 'uz')}>{lang === 'uz' ? 'O‘z/Ru' : 'Ru/O‘z'}</button><span className="location-pill">⌖ Toshkent</span><button className="round-btn">♡</button><button className="account-btn">{text.login}</button></div>
    </div></header>

    <section className="catalog-top"><div className="container">
      <div className="breadcrumbs"><a href="/">{text.home}</a><span>›</span><b>{text.property}</b></div>
      <div className="catalog-title"><div><span className="hero-kicker">PROHOUSE MARKETPLACE</span><h1>{text.property}</h1><p>{lang === 'uz' ? 'O‘zbekiston bo‘ylab uy, kvartira va boshqa ko‘chmas mulklarni toping.' : 'Найдите квартиры, дома и другую недвижимость по всему Узбекистану.'}</p></div><a className="post-outline" href="#">+ {text.post}</a></div>
      <div className="catalog-search"><input value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} onKeyDown={e=>e.key==='Enter'&&setPage(1)} placeholder={text.searchPlaceholder}/><button onClick={()=>setPage(1)}>⌕ {text.search}</button></div>
      <div className="catalog-tabs"><button className={tab==='sale'?'active':''} onClick={()=>setTab('sale')}>{text.buy}</button><button className={tab==='rent'?'active':''} onClick={()=>setTab('rent')}>{text.rent}</button><button className={tab==='daily'?'active':''} onClick={()=>setTab('daily')}>{text.daily}</button><button className={tab==='new_building'?'active':''} onClick={()=>setTab('new_building')}>{text.new}</button><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>{text.all}</button></div>
    </div></section>

    <section className="container catalog-body">
      <aside className="filter-panel">
        <div className="filter-head"><div><b>{text.filters}</b><span>{total} {text.found}</span></div><button onClick={clearFilters}>{text.reset}</button></div>
        <label className="filter-field"><span>{text.district}</span><select value={district} onChange={e=>setDistrict(e.target.value)}><option value="">{text.allDistricts}</option>{districts.map(d=><option key={d}>{d}</option>)}</select></label>
        <label className="filter-field"><span>{text.type}</span><select value={type} onChange={e=>setType(e.target.value)}><option value="">{text.allTypes}</option><option value="apartment">{text.apartment}</option><option value="house">{text.house}</option><option value="land">{text.land}</option><option value="commercial">{text.commercial}</option><option value="new_building">{text.newBuilding}</option></select></label>
        <div className="filter-block"><span>{text.price}</span><div className="price-inputs"><input value={minPrice} onChange={e=>setMinPrice(e.target.value)} placeholder={text.min}/><input value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder={text.max}/></div><select className="currency-select" value={currency} onChange={e=>setCurrency(e.target.value)}><option value="UZS">so‘m</option><option value="USD">USD</option></select></div>
        <label className="filter-field"><span>{text.rooms}</span><select value={rooms} onChange={e=>setRooms(e.target.value)}><option value="">{text.anyRooms}</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5+</option></select></label>
        <div className="check-list"><label><input type="checkbox" checked={owner} onChange={e=>setOwner(e.target.checked)}/><span>{text.owner}</span></label><label><input type="checkbox" checked={mortgage} onChange={e=>setMortgage(e.target.checked)}/><span>{text.mortgage}</span></label><label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/><span>{text.verified}</span></label><label><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)}/><span>{text.featured}</span></label></div>
        <button className="filter-apply" onClick={()=>setPage(1)}>{text.apply}</button>
      </aside>

      <div className="results-area">
        <div className="results-head"><div><h2>{loading ? '…' : new Intl.NumberFormat('ru-RU').format(total)} <span>{text.found}</span></h2><p>{district || 'Toshkent'} · {tab==='sale'?text.buy:tab==='rent'?text.rent:tab==='daily'?text.daily:text.new}</p></div><div className="result-actions"><select value={sort} onChange={e=>setSort(e.target.value as Sort)}><option value="newest">{text.newest}</option><option value="price_asc">{text.lowPrice}</option><option value="price_desc">{text.highPrice}</option><option value="area_desc">{text.area}</option></select><div className="view-toggle"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')}>▦</button><button className={view==='list'?'active':''} onClick={()=>setView('list')}>☷</button><button>⌖</button></div></div></div>
        {loading ? <div className="loading-grid">{Array.from({length:6}).map((_,i)=><div className="skeleton-card" key={i}/>)}</div> : listings.length ? <div className={`catalog-grid ${view==='list'?'list-view':''}`}>{listings.map(p=><PropertyCard key={p.id} p={p} lang={lang} title={displayTitle(p)} text={text}/>)}</div> : <div className="empty-state"><div>⌂</div><h3>{text.noResults}</h3><p>{text.noResultsText}</p><button onClick={clearFilters}>{text.clearAll}</button></div>}
        <div className="pagination"> <button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>{text.previous}</button><div>{Array.from({length:Math.min(pages,5)},(_,i)=>{const n=i+1;return <button key={n} className={page===n?'active':''} onClick={()=>setPage(n)}>{n}</button>})}{pages>5&&<span>…</span>}</div><button disabled={page===pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>{text.next}</button></div>
      </div>
    </section>

    <footer className="catalog-footer"><div className="container"><div><a className="brand" href="/"><span className="brand-mark">⌂</span><span>Pro<span>house</span></span></a><p>{lang==='uz'?'O‘zbekistonning zamonaviy ko‘chmas mulk platformasi.':'Современная платформа недвижимости Узбекистана.'}</p></div><div><b>{text.property}</b><a href="/properties">{text.buy}</a><a href="#">{text.rent}</a><a href="#">{text.new}</a></div><div><b>{lang==='uz'?'Xizmatlar':'Услуги'}</b><a href="#">{lang==='uz'?'Ipoteka':'Ипотека'}</a><a href="#">{lang==='uz'?'Rieltorlar':'Риелторы'}</a><a href="#">{lang==='uz'?'Yordam':'Помощь'}</a></div></div><div className="container catalog-footer-bottom">© 2026 Prohouse · {lang==='uz'?'Barcha huquqlar himoyalangan':'Все права защищены'}</div></footer>
  </main>
}

function PropertyCard({p,lang,title,text}:{p:Listing;lang:Lang;title:string;text:any}) {
  return <article className="catalog-card">
    <a href={`/properties/${p.id}`} className="catalog-image" style={{backgroundImage:`url(${p.image_url || 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85'})`}}>
      <span className={`catalog-badge ${p.is_featured?'vip':''}`}>{p.is_featured?'TOP':p.is_verified?'✓ '+text.verifiedSeller:text.new}</span><button className="catalog-heart" onClick={e=>e.preventDefault()}>♡</button>
    </a>
    <div className="catalog-card-body"><div className="catalog-price">{formatMoney(p.price,p.currency)}</div><h3>{title}</h3><div className="catalog-location">⌖ {p.city}{p.district ? `, ${p.district}` : ''}</div><div className="catalog-meta"><span>{p.area_m2 ? `${p.area_m2} m²` : '—'}</span><span>{p.rooms ? `${p.rooms} xona` : ''}</span><span>{p.floor && p.floors_total ? `${p.floor}/${p.floors_total} qavat` : ''}</span></div><div className="catalog-seller"><span className={p.is_verified?'verified-dot':''}>●</span>{p.seller_name || (p.seller_type==='owner'?text.owner:text.property)}</div></div>
  </article>
}
