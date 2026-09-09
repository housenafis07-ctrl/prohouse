'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'

type Lang = 'uz' | 'ru'
type Tab = 'sale' | 'rent' | 'daily' | 'all'
type Taxonomy = {
  code: string
  parent_code: string | null
  name_uz: string
  name_ru: string | null
  section_code: string
  listing_type: string | null
  property_type: string | null
  node_type: string
  is_owner_filter: boolean
  is_mortgage_filter: boolean
  is_new_construction_filter: boolean
  sort_order: number
}
type Listing = {
  id:string; title:string; title_ru?:string|null; listing_type:string; property_type:string|null; price:number; currency:string
  area_m2:number|null; rooms:number|null; floor:number|null; floors_total:number|null; district:string|null; city:string
  latitude?:number|null; longitude?:number|null; seller_type:string; seller_name:string|null
  is_mortgage_available:boolean; is_verified:boolean; is_trusted_seller:boolean; is_featured:boolean; published_at:string|null
  taxonomy_code?:string|null; listing_images?:{image_url:string;sort_order:number|null}[]
}
const normalize=(v:string)=>v.toLowerCase().replace(/[ʻʼ`’']/g,'').replace(/ tumani/g,'').replace(/ shahar/g,'').trim()
const money=(v:number,c:string)=>`${new Intl.NumberFormat('ru-RU').format(Number(v))} ${c==='USD'?'$':'so‘m'}`
const titleOf=(x:Listing,l:Lang)=>l==='ru'?(x.title_ru||x.title):x.title
const regionOf=(x:Listing)=>{if(x.city==='Toshkent'||x.city==='Ташкент')return 'Toshkent shahri';const d=normalize(x.district||'');return UZBEKISTAN_LOCATIONS.find(r=>r.districts.some(n=>{const q=normalize(n);return q===d||q.includes(d)||d.includes(q)}))?.name||''}
const propertyTypeLabel=(v:string|null|undefined,l:Lang)=>({apartment:l==='ru'?'Квартира':'Kvartira',house:l==='ru'?'Частный дом':'Xususiy uy',land:l==='ru'?'Земля':'Yer',commercial:l==='ru'?'Коммерция':'Tijorat',new_building:l==='ru'?'Новостройка':'Yangi bino'})[v||'']||v||''

export default function ListingsPage(){
  const router=useRouter()
  const[lang,setLang]=useState<Lang>('uz');const[items,setItems]=useState<Listing[]>([]);const[categories,setCategories]=useState<Taxonomy[]>([])
  const[tab,setTab]=useState<Tab>('sale');const[region,setRegion]=useState('');const[district,setDistrict]=useState('');const[type,setType]=useState('');const[category,setCategory]=useState('');const[min,setMin]=useState('');const[max,setMax]=useState('');const[currency,setCurrency]=useState('');const[rooms,setRooms]=useState('');const[verified,setVerified]=useState(false);const[owner,setOwner]=useState(false);const[mortgage,setMortgage]=useState(false);const[newConstruction,setNewConstruction]=useState(false);const[sort,setSort]=useState('newest')
  const[loading,setLoading]=useState(true);const[saveOpen,setSaveOpen]=useState(false);const[saveName,setSaveName]=useState('');const[saveBusy,setSaveBusy]=useState(false);const[saveMessage,setSaveMessage]=useState('')

  useEffect(()=>{
    const saved=localStorage.getItem('prohouse-lang');if(saved==='ru')setLang('ru')
    const q=new URLSearchParams(window.location.search);const t=q.get('tab');if(['sale','rent','daily','all'].includes(t||''))setTab(t as Tab)
    setRegion(q.get('region')||'');setDistrict(q.get('district')||'');setType(q.get('type')||'');setCategory(q.get('taxonomy')||'');setMin(q.get('min')||'');setMax(q.get('max')||'');setCurrency(q.get('currency')||'');setRooms(q.get('rooms')||'');setVerified(q.get('verified')==='true');setOwner(q.get('owner')==='true');setMortgage(q.get('mortgage')==='true');setNewConstruction(q.get('newConstruction')==='true')
    ;(async()=>{try{const db=createClient();const[{data:listings,error:listingsError},{data:taxonomy,error:taxonomyError}]=await Promise.all([
      db.from('listings').select('*, listing_images(image_url,sort_order)').eq('status','active'),
      fetch('/api/listings/search-meta').then(async r=>{const body=await r.json();return {data:body.categories||[],error:r.ok?null:new Error(body.error||'Taxonomy yuklanmadi')}}),
    ]);if(!listingsError)setItems((listings||[]) as Listing[]);if(!taxonomyError)setCategories((taxonomy||[]) as Taxonomy[])}finally{setLoading(false)}})()
  },[])

  const districts=useMemo(()=>region?UZBEKISTAN_LOCATIONS.find(x=>x.name===region)?.districts??[]:[],[region])
  const propertyTypes=useMemo(()=>Array.from(new Set(categories.map(c=>c.property_type).filter((v):v is string=>Boolean(v)))),[categories])
  const categoryOptions=useMemo(()=>categories.filter(c=>c.node_type==='category'),[categories])
  const newConstructionCodes=useMemo(()=>new Set(categories.filter(c=>c.is_new_construction_filter).map(c=>c.code)),[categories])

  const filtered=useMemo(()=>{
    const lo=min===''?0:Number(min),hi=max===''?Infinity:Number(max)
    return items
      .filter(x=>!category||x.taxonomy_code===category)
      .filter(x=>!newConstruction||newConstructionCodes.has(x.taxonomy_code||''))
      .filter(x=>tab==='all'||x.listing_type===tab||(tab==='sale'&&x.listing_type==='new_building'))
      .filter(x=>!region||regionOf(x)===region)
      .filter(x=>!district||normalize(x.district||'')===normalize(district))
      .filter(x=>!type||x.property_type===type)
      .filter(x=>!rooms||(x.rooms??0)>=Number(rooms))
      .filter(x=>!currency||x.currency===currency)
      .filter(x=>Number(x.price)>=lo&&Number(x.price)<=hi)
      .filter(x=>!verified||x.is_verified)
      .filter(x=>!owner||x.seller_type==='owner')
      .filter(x=>!mortgage||x.is_mortgage_available)
      .sort((a,b)=>sort==='priceLow'?a.price-b.price:sort==='priceHigh'?b.price-a.price:new Date(b.published_at||0).getTime()-new Date(a.published_at||0).getTime())
  },[items,category,newConstruction,newConstructionCodes,tab,region,district,type,rooms,currency,min,max,verified,owner,mortgage,sort])

  const buildQuery=()=>({tab,region,district,type,min,max,currency,rooms,verified,owner,mortgage,taxonomy:category,newConstruction})
  const push=()=>{const q=new URLSearchParams();q.set('tab',tab);if(region)q.set('region',region);if(district)q.set('district',district);if(type)q.set('type',type);if(min)q.set('min',min);if(max)q.set('max',max);if(currency)q.set('currency',currency);if(rooms)q.set('rooms',rooms);if(verified)q.set('verified','true');if(owner)q.set('owner','true');if(mortgage)q.set('mortgage','true');if(category)q.set('taxonomy',category);if(newConstruction)q.set('newConstruction','true');router.push(`/listings?${q.toString()}`)}
  const clear=()=>{setTab('sale');setRegion('');setDistrict('');setType('');setCategory('');setMin('');setMax('');setCurrency('');setRooms('');setVerified(false);setOwner(false);setMortgage(false);setNewConstruction(false);setSort('newest');router.push('/listings?tab=sale')}
  const saveSearch=async()=>{setSaveBusy(true);setSaveMessage('');try{const response=await fetch('/api/searches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:saveName.trim()||`${lang==='ru'?'Поиск':'Qidiruv'} ${new Date().toLocaleDateString()}`,query:buildQuery(),notifyPush:true})});const result=await response.json().catch(()=>({}));if(response.status===401){router.push('/register?redirect=/listings');return}if(!response.ok)throw new Error(result.error||'Qidiruvni saqlab bo‘lmadi.');setSaveMessage(lang==='ru'?'Поиск сохранён.':'Qidiruv saqlandi.');setSaveName('');setTimeout(()=>setSaveOpen(false),700)}catch(e){setSaveMessage(e instanceof Error?e.message:'Xatolik yuz berdi.')}finally{setSaveBusy(false)}}

  const text=lang==='ru'?{title:'Объявления',sub:'Найдите подходящую недвижимость и услуги',filters:'Фильтры',location:'Расположение',district:'Район / город',category:'Категория',type:'Тип недвижимости',currency:'Валюта',rooms:'Комнаты',from:'от',to:'до',owner:'От владельца',mortgage:'Ипотека доступна',verified:'Проверено',newConstruction:'Новостройка',apply:'Применить',clear:'Сбросить',all:'Все',allTypes:'Все типы',empty:'По вашему запросу объявлений нет.',newest:'Новые',low:'Дешевле',high:'Дороже',save:'Сохранить поиск',saveTitle:'Название поиска',savePlaceholder:'Например: 3-комнатная в Ташкенте',saveConfirm:'Сохранить',cancel:'Отмена'}:{title:'E’lonlar',sub:'Sizga mos ko‘chmas mulk va xizmatlarni toping',filters:'Filtrlar',location:'Joylashuv',district:'Tuman / shahar',category:'Bo‘lim / kategoriya',type:'Ko‘chmas mulk turi',currency:'Valyuta',rooms:'Xonalar',from:'dan',to:'gacha',owner:'Egadan',mortgage:'Ipotekaga mumkin',verified:'Tasdiqlangan',newConstruction:'Yangi qurilish',apply:'Qo‘llash',clear:'Tozalash',all:'Barchasi',allTypes:'Barcha turlar',empty:'Tanlangan shartlar bo‘yicha e’lon topilmadi.',newest:'Eng yangi',low:'Arzonidan',high:'Qimmatidan',save:'Qidiruvni saqlash',saveTitle:'Qidiruv nomi',savePlaceholder:'Masalan: Toshkentda 3 xonali',saveConfirm:'Saqlash',cancel:'Bekor qilish'}
  const tabs=[['sale',lang==='ru'?'Продажа':'Sotuv'],['rent',lang==='ru'?'Аренда':'Ijara'],['daily',lang==='ru'?'Посуточно':'Kunlik'],['all',lang==='ru'?'Все':'Barchasi']] as [Tab,string][]

  return <main className="min-h-screen bg-[#f6f7f8] text-slate-900">
    <header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4"><Link href="/" className="text-xl font-black">Pro<span className="text-emerald-500">house</span></Link><div className="flex items-center gap-2"><Link href="/account/saved-searches" className="hidden rounded-xl border px-3 py-2 text-xs font-bold sm:block">⌕ {lang==='ru'?'Сохранённые поиски':'Saqlangan qidiruvlar'}</Link><Link href="/account/favorites" className="hidden rounded-xl border px-3 py-2 text-xs font-bold sm:block">♡ {lang==='ru'?'Избранное':'Saqlanganlar'}</Link><button onClick={()=>{const n=lang==='uz'?'ru':'uz';setLang(n);localStorage.setItem('prohouse-lang',n)}} className="rounded-xl border px-3 py-2 text-xs font-bold">{lang==='uz'?'O‘z / Ru':'Ru / O‘z'}</button></div></div></header>
    <section className="border-b bg-white"><div className="mx-auto max-w-[1440px] px-4 py-6"><Link href="/" className="text-xs text-slate-500">{lang==='ru'?'Главная':'Bosh sahifa'}</Link><h1 className="mt-3 text-3xl font-black">{text.title}</h1><p className="mt-1 text-sm text-slate-500">{text.sub}</p>{category&&<div className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{categories.find(c=>c.code===category)?.[lang==='ru'?'name_ru':'name_uz']||category}</div>}</div></section>
    <div className="mx-auto max-w-[1440px] px-4 py-5"><div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border bg-white p-1.5 shadow-sm">{tabs.map(([v,l])=><button key={v} onClick={()=>{setTab(v);router.push(`/listings?tab=${v}`)}} className={`rounded-xl px-5 py-2.5 text-sm font-bold ${tab===v?'bg-emerald-500 text-white':'text-slate-600'}`}>{l}</button>)}</div>
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><aside className="h-fit rounded-2xl border bg-white p-5 shadow-sm"><div className="mb-5 flex justify-between"><b>{text.filters}</b><button onClick={clear} className="text-xs font-bold text-emerald-600">{text.clear}</button></div>
        <label className="block text-sm font-semibold">{text.location}<select value={region} onChange={e=>{setRegion(e.target.value);setDistrict('')}} className="mt-2 h-11 w-full rounded-xl border px-3"><option value="">{lang==='ru'?'Весь Узбекистан':'Butun O‘zbekiston'}</option>{UZBEKISTAN_LOCATIONS.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}</select></label>
        <label className="mt-4 block text-sm font-semibold">{text.district}<select disabled={!region} value={district} onChange={e=>setDistrict(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 disabled:bg-slate-100"><option value="">{lang==='ru'?'Все районы и города':'Barcha tuman va shaharlar'}</option>{districts.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label className="mt-4 block text-sm font-semibold">{text.category}<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3"><option value="">{text.all}</option>{categoryOptions.map(x=><option key={x.code} value={x.code}>{lang==='ru'?(x.name_ru||x.name_uz):x.name_uz}</option>)}</select></label>
        <label className="mt-4 block text-sm font-semibold">{text.type}<select value={type} onChange={e=>setType(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3"><option value="">{text.allTypes}</option>{propertyTypes.map(x=><option key={x} value={x}>{propertyTypeLabel(x,lang)}</option>)}</select></label>
        <div className="mt-4"><p className="text-sm font-semibold">{text.currency}</p><div className="mt-2 grid grid-cols-3 gap-2">{[['','All'],['UZS','so‘m'],['USD','$']].map(([v,l])=><button key={v||'all'} onClick={()=>setCurrency(v)} className={`rounded-lg border px-2 py-2 text-xs font-bold ${currency===v?'border-emerald-500 bg-emerald-50':''}`}>{l}</button>)}</div></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><input value={min} onChange={e=>setMin(e.target.value)} inputMode="numeric" placeholder={text.from} className="h-11 rounded-xl border px-3"/><input value={max} onChange={e=>setMax(e.target.value)} inputMode="numeric" placeholder={text.to} className="h-11 rounded-xl border px-3"/></div>
        <div className="mt-4"><p className="text-sm font-semibold">{text.rooms}</p><div className="mt-2 grid grid-cols-4 gap-2">{['1','2','3','4'].map(v=><button key={v} onClick={()=>setRooms(rooms===v?'':v)} className={`rounded-lg border py-2 text-sm font-bold ${rooms===v?'border-emerald-500 bg-emerald-50':''}`}>{v==='4'?'4+':v}</button>)}</div></div>
        <div className="mt-5 space-y-3 border-t pt-4 text-sm"><label className="flex gap-3"><input type="checkbox" checked={owner} onChange={e=>setOwner(e.target.checked)}/>{text.owner}</label><label className="flex gap-3"><input type="checkbox" checked={mortgage} onChange={e=>setMortgage(e.target.checked)}/>{text.mortgage}</label><label className="flex gap-3"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>{text.verified}</label>{newConstructionCodes.size>0&&<label className="flex gap-3"><input type="checkbox" checked={newConstruction} onChange={e=>setNewConstruction(e.target.checked)}/>{text.newConstruction}</label>}</div>
        <button onClick={push} className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white">{text.apply}</button><button onClick={()=>{setSaveOpen(true);setSaveMessage('')}} className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-black text-emerald-700">⌕ {text.save}</button>
      </aside>
      <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><b>{filtered.length} {lang==='ru'?'объявлений':'ta e’lon'}</b><div className="flex items-center gap-2"><select value={sort} onChange={e=>setSort(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm"><option value="newest">{text.newest}</option><option value="priceLow">{text.low}</option><option value="priceHigh">{text.high}</option></select><button onClick={()=>{setSaveOpen(true);setSaveMessage('')}} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-extrabold text-emerald-700">⌕ {text.save}</button></div></div>{loading&&<p className="mb-3 text-xs text-slate-400">{lang==='ru'?'Загрузка...':'Yuklanmoqda...'}</p>}{!loading&&!filtered.length&&<div className="rounded-2xl border bg-white p-10 text-center text-slate-500">{text.empty}</div>}<div className="grid gap-4 sm:grid-cols-2">{filtered.map(x=>{const image=x.listing_images?.slice().sort((a,b)=>(a.sort_order??0)-(b.sort_order??0))[0]?.image_url;const period=x.listing_type==='rent'?' / oy':x.listing_type==='daily'?' / kun':'';const isService=x.listing_type==='service'||x.listing_type==='realtor';return <Link key={x.id} href={`/listings/${x.id}`} className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="relative aspect-[4/3] overflow-hidden bg-slate-100">{image?<img src={image} alt={titleOf(x,lang)} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>:<div className="flex h-full items-center justify-center text-slate-400">{lang==='ru'?'Нет фото':'Rasm yo‘q'}</div>}{x.is_featured&&<span className="absolute left-3 top-3 rounded-lg bg-amber-400 px-2 py-1 text-xs font-black">TOP</span>}{x.is_verified&&<span className="absolute right-3 top-3 rounded-lg bg-white px-2 py-1 text-xs font-bold text-emerald-700">✓ {lang==='ru'?'Проверено':'Tasdiqlangan'}</span>}{x.is_trusted_seller&&<span className="absolute bottom-3 left-3 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-700">✓ {lang==='ru'?'Надёжный профиль':'Ishonchli profil'}</span>}{x.seller_type==='owner'&&<span className="absolute bottom-3 right-3 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-700">{lang==='ru'?'От владельца':'Egadan'}</span>}</div><div className="p-4"><h2 className="text-lg font-black">{money(x.price,x.currency)}{period}</h2><p className="mt-1 line-clamp-2 text-sm font-bold">{titleOf(x,lang)}</p><p className="mt-2 text-xs text-slate-500">⌖ {x.city}{x.district?`, ${x.district}`:''}</p><div className="mt-3 flex flex-wrap gap-1.5 text-xs"><span className="rounded-md bg-slate-100 px-2 py-1">{isService?(x.listing_type==='realtor'?(lang==='ru'?'Риелтор':'Rieltor'):(lang==='ru'?'Услуга':'Xizmat')):propertyTypeLabel(x.property_type,lang)}</span>{x.area_m2!=null&&!isService&&<span className="rounded-md bg-slate-100 px-2 py-1">{x.area_m2} m²</span>}{x.rooms!=null&&!isService&&<span className="rounded-md bg-slate-100 px-2 py-1">{x.rooms} {lang==='ru'?'комн.':'xona'}</span>}</div><div className="mt-4 border-t pt-3 text-xs font-semibold text-slate-600">{x.seller_name||(lang==='ru'?'Продавец':'Sotuvchi')}</div></div></Link>})}</div></section></div></div>
    {saveOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">{text.save}</h2><p className="mt-1 text-sm text-slate-500">{text.saveTitle}</p></div><button onClick={()=>setSaveOpen(false)} className="rounded-full bg-slate-100 px-3 py-1 text-lg">×</button></div><input autoFocus value={saveName} onChange={e=>setSaveName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void saveSearch()}} placeholder={text.savePlaceholder} className="mt-5 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500"/>{saveMessage&&<p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{saveMessage}</p>}<div className="mt-5 flex gap-3"><button onClick={()=>setSaveOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-3 font-bold text-slate-700">{text.cancel}</button><button disabled={saveBusy} onClick={()=>void saveSearch()} className="flex-1 rounded-xl bg-emerald-600 py-3 font-black text-white disabled:opacity-50">{saveBusy?'...':text.saveConfirm}</button></div></div></div>}
  </main>
}
