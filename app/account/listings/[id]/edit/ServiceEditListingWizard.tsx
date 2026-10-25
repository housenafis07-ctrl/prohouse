'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ListingLocationPicker from '@/app/components/ListingLocationPicker'
import ListingImageManager, { type ListingImageManagerHandle } from '@/app/components/ListingImageManager'
import { useI18n } from '@/app/components/I18nProvider'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'

type Category = { code:string; parent_code:string|null; name_uz:string; name_ru:string|null; section_code:string; listing_type:string|null; property_type:string|null; entity_type:string; is_listable?:boolean; sort_order:number }
type Listing = { id:string; listing_code:string; title:string; description:string|null; listing_type:string; property_type:string; status:string; price:number; currency:string; city:string; district:string|null; neighborhood:string|null; address:string|null; latitude:number|null; longitude:number|null; taxonomy_code:string|null; draft_data:Record<string,unknown>|null }
type ServiceRegion = { scope:'all'|'province'|'district'; province:string; district?:string }

const steps = [
  {uz:'Xizmat turi',ru:'Услуга'},
  {uz:'Ma’lumotlar',ru:'Данные'},
  {uz:'Hudud',ru:'Регион'},
  {uz:'Narx',ru:'Цена'},
  {uz:'Rasmlar',ru:'Фото'},
  {uz:'Tekshirish',ru:'Проверка'},
]

const cleanDistrict = (value:string) => value.replace(/ tumani$/i,'').replace(/ shahri$/i,'')

export default function ServiceEditListingWizard(){
  const params=useParams<{id:string}>(); const router=useRouter(); const imageManagerRef=useRef<ListingImageManagerHandle>(null)
  const {lang}=useI18n(); const ru=lang==='ru'; const t=(uz:string,rr:string)=>ru?rr:uz
  const [listing,setListing]=useState<Listing|null>(null); const [categories,setCategories]=useState<Category[]>([])
  const [step,setStep]=useState(1); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [success,setSuccess]=useState('')
  const [form,setForm]=useState({taxonomy_code:'',title:'',description:'',price:'',currency:'UZS',city:'Toshkent viloyati',district:'',address:'',neighborhood:'',contact_phone:'',company_name:''})
  const [location,setLocation]=useState<{latitude:number|null;longitude:number|null}>({latitude:null,longitude:null})
  const [serviceRegions,setServiceRegions]=useState<ServiceRegion[]>([])

  const selected=useMemo(()=>categories.find(c=>c.code===form.taxonomy_code)||null,[categories,form.taxonomy_code])
  const allUzbekistan=serviceRegions.some(r=>r.scope==='all')
  const region=useMemo(()=>UZBEKISTAN_LOCATIONS.find(x=>x.name===form.city),[form.city])
  const districts=region?.districts||[]
  const update=(key:keyof typeof form,value:string)=>setForm(v=>({...v,[key]:value}))

  useEffect(()=>{let active=true;(async()=>{try{
    const db=createClient(); const {data:{user}}=await db.auth.getUser(); if(!user){router.replace('/register');return}
    const {data,error:e}=await db.from('listings').select('id,listing_code,title,description,listing_type,property_type,status,price,currency,city,district,neighborhood,address,latitude,longitude,taxonomy_code,draft_data').eq('id',params.id).eq('owner_id',user.id).maybeSingle()
    if(e)throw e; if(!data)throw new Error(t('E’lon topilmadi.','Объявление не найдено'))
    const meta=await fetch('/api/listings/meta?flow=service',{cache:'no-store'}); const md=await meta.json(); if(!meta.ok)throw new Error(md.error||t('Kategoriya ma’lumotlari yuklanmadi.','Не удалось загрузить категории'))
    const serviceCategories=(md.categories||[]).filter((c:Category)=>c.section_code==='services'&&c.entity_type==='service'&&c.is_listable!==false)
    if(!active)return
    const row=data as Listing; const draft=(row.draft_data||{}) as Record<string,unknown>; const a=draft.attributes&&typeof draft.attributes==='object'?draft.attributes as Record<string,unknown>:{}
    const savedRegions=Array.isArray(draft.service_regions)?draft.service_regions as ServiceRegion[]:[]
    const savedScope=draft.service_area_scope==='all'
    setListing(row); setCategories(serviceCategories)
    setServiceRegions(savedScope||savedRegions.some(r=>r.scope==='all')?[{scope:'all',province:'O‘zbekiston'}]:savedRegions)
    setForm({taxonomy_code:row.taxonomy_code||'',title:row.title||'',description:row.description||'',price:String(row.price??''),currency:row.currency||'UZS',city:row.city||'Toshkent viloyati',district:row.district||'',address:row.address||'',neighborhood:row.neighborhood||'',contact_phone:String(draft.contact_phone??a.contact_phone??''),company_name:String(draft.company_name??a.company_name??'')})
    setLocation({latitude:row.latitude,longitude:row.longitude}); setLoading(false)
  }catch(e){if(active){setError(e instanceof Error?e.message:t('E’lonni yuklashda xatolik.','Ошибка загрузки объявления.'));setLoading(false)}}})();return()=>{active=false}},[params.id,router])

  const selectAllUzbekistan=()=>{
    const next=!allUzbekistan
    setServiceRegions(next?[{scope:'all',province:'O‘zbekiston'}]:[])
    if(next){
      update('city','O‘zbekiston')
      update('district','')
      setLocation({latitude:null,longitude:null})
    }
  }

  const selectProvince=(province:string)=>{
    setServiceRegions([{scope:'province',province}])
    update('city',province)
    update('district','')
  }

  const selectDistrict=(district:string)=>{
    setServiceRegions([{scope:'district',province:form.city,district}])
    update('district',district)
  }

  const validate=()=>{
    if(step>=1&&!form.taxonomy_code)return t('Xizmat turini tanlang.','Выберите услугу.')
    if(step>=2&&!form.title.trim())return t('Xizmat sarlavhasini kiriting.','Введите заголовок услуги.')
    if(step>=2&&!form.description.trim())return t('Xizmat tavsifini kiriting.','Введите описание услуги.')
    if(step>=3&&!serviceRegions.length)return t('Xizmat ko‘rsatiladigan hududni tanlang.','Выберите регион оказания услуги.')
    if(step>=3&&!allUzbekistan&&!form.district)return t('Xizmat ko‘rsatiladigan hududni tanlang.','Выберите район/город оказания услуги.')
    if(step>=3&&!allUzbekistan&&(location.latitude==null||location.longitude==null))return t('Xaritadan hududni belgilang.','Укажите расположение на карте.')
    if(step>=4&&(!form.price||!Number.isFinite(Number(form.price.replace(/\s/g,'')))))return t('To‘g‘ri narx kiriting.','Введите корректную цену.')
    return ''
  }

  const next=async()=>{const v=validate();if(v){setError(v);return}setError('');if(step<6)setStep(s=>s+1)}
  const back=()=>{setError('');setStep(s=>Math.max(1,s-1))}

  const save=async()=>{if(!listing)return;const v=validate();if(v){setError(v);return}setSaving(true);setError('');setSuccess('');try{
    if(imageManagerRef.current?.hasPendingChanges())await imageManagerRef.current.saveChanges()
    const db=createClient(); const {data:{user}}=await db.auth.getUser(); if(!user)throw new Error('AUTH_REQUIRED')
    const price=Number(form.price.replace(/\s/g,'')); const oldDraft=(listing.draft_data||{}) as Record<string,unknown>
    const draft={...oldDraft,...form,price:form.price.replace(/\s/g,''),latitude:location.latitude,longitude:location.longitude,service_area_scope:allUzbekistan?'all':'selected',service_regions:serviceRegions,attributes:{...(oldDraft.attributes&&typeof oldDraft.attributes==='object'?oldDraft.attributes as Record<string,unknown>:{}),contact_phone:form.contact_phone,company_name:form.company_name}}
    const {error:e}=await db.rpc('save_owner_listing',{p_listing_id:listing.id,p_payload:{taxonomy_code:form.taxonomy_code,title:form.title.trim(),description:form.description.trim()||null,listing_type:'service',property_type:'service',price:String(price),currency:form.currency,area_m2:'',rooms:'',floor:'',floors_total:'',city:form.city,district:form.district,neighborhood:form.neighborhood,address:form.address,latitude:location.latitude==null?'':String(location.latitude),longitude:location.longitude==null?'':String(location.longitude),ownership_type:null,is_mortgage_available:false,draft_data:draft}})
    if(e)throw e
    setSuccess(t('O‘zgarishlar saqlandi va e’lon qayta moderatsiyaga yuborildi.','Изменения сохранены, объявление повторно отправлено на модерацию.'));setTimeout(()=>router.push('/account/listings'),800)
  }catch(e){setError(e instanceof Error?e.message:t('E’lonni saqlashda xatolik yuz berdi.','Произошла ошибка при сохранении объявления.'))}finally{setSaving(false)}}

  if(loading)return <main className="min-h-screen bg-slate-50 p-8 text-center text-slate-500">{t('Yuklanmoqda...','Загрузка...')}</main>
  if(!listing)return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 text-center"><p className="font-bold">{error||t('E’lon topilmadi','Объявление не найдено')}</p><Link href="/account/listings" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">{t('Mening e’lonlarim','Мои объявления')}</Link></div></main>

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10"><div className="mx-auto max-w-4xl">
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">ROYALHOUSE</p><h1 className="mt-1 text-2xl font-bold">{t('Xizmat e’lonini tahrirlash','Редактирование объявления об услуге')}</h1><p className="mt-1 text-sm text-slate-500">{t('Xizmat e’lonlari uchun maxsus tahrirlash formasi.','Специальная форма редактирования услуги.')}</p></div><Link href="/account" className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">{t('Shaxsiy kabinet','Личный кабинет')}</Link></div>
    <div className="mb-5 grid grid-cols-6 gap-1">{steps.map((x,i)=><button type="button" key={x.uz} onClick={()=>i+1<=step&&setStep(i+1)} className={`rounded-xl px-1 py-2 text-center text-[11px] font-semibold ${i+1===step?'bg-slate-950 text-white':i+1<step?'bg-slate-200 text-slate-700':'bg-white text-slate-400'}`}><span className="hidden sm:inline">{i+1}. </span>{ru?x.ru:x.uz}</button>)}</div>
    <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-8">
      {error&&<div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}{success&&<div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{success}</div>}
      {step===1&&<div><h2 className="text-xl font-bold">1. {t('Xizmat turini tanlang','Выберите услугу')}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{categories.map(c=><button type="button" key={c.code} onClick={()=>update('taxonomy_code',c.code)} className={`rounded-2xl border p-5 text-left ${selected?.code===c.code?'border-slate-950 bg-slate-50':''}`}><b>{ru?(c.name_ru||c.name_uz):c.name_uz}</b></button>)}</div></div>}
      {step===2&&<div><h2 className="text-xl font-bold">2. {t('Xizmat ma’lumotlari','Данные услуги')}</h2><div className="mt-5 grid gap-4"><label className="text-sm font-semibold">{t('Sarlavha','Заголовок')}<input value={form.title} onChange={e=>update('title',e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label><label className="text-sm font-semibold">{t('Tavsif','Описание')}<textarea value={form.description} onChange={e=>update('description',e.target.value)} rows={6} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">{t('Telefon','Телефон')}<input value={form.contact_phone} onChange={e=>update('contact_phone',e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label><label className="text-sm font-semibold">{t('Kompaniya / ism','Компания / имя')}<input value={form.company_name} onChange={e=>update('company_name',e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label></div></div></div>}
      {step===3&&<div><h2 className="text-xl font-bold">3. {t('Xizmat ko‘rsatiladigan hudud','Регион оказания услуги')}</h2><p className="mt-1 text-sm text-slate-500">{t('Viloyat va tuman/shaharni tanlang yoki butun O‘zbekiston bo‘ylab xizmat ko‘rsatishni belgilang.','Выберите область и район/город или укажите оказание услуг по всему Узбекистану.')}</p>
        <button type="button" onClick={selectAllUzbekistan} className={`mt-5 flex w-full items-center justify-between rounded-2xl border p-4 text-left ${allUzbekistan?'border-emerald-500 bg-emerald-50':'hover:border-slate-950'}`}><span><b>{t('🇺🇿 Butun O‘zbekiston bo‘ylab','🇺🇿 Весь Узбекистан')}</b><small className="block text-slate-500">{t('Barcha viloyat va tumanlarda xizmat ko‘rsataman','Оказываю услуги во всех регионах')}</small></span><input readOnly type="checkbox" checked={allUzbekistan} className="h-5 w-5"/></button>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">{t('Shahar/viloyat','Город/область')}<select disabled={allUzbekistan} value={allUzbekistan?'O‘zbekiston':form.city} onChange={e=>selectProvince(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-50 disabled:text-slate-400"><option value="">{t('Tanlang','Выберите')}</option>{UZBEKISTAN_LOCATIONS.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}</select></label>
          <label className="text-sm font-semibold">{t('Tuman/shahar','Район/город')}<select disabled={allUzbekistan||!form.city} value={allUzbekistan?'':form.district} onChange={e=>selectDistrict(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-50 disabled:text-slate-400"><option value="">{t('Tanlang','Выберите')}</option>{districts.map(district=><option key={district} value={district}>{cleanDistrict(district)}</option>)}</select></label>
        </div>
        {!allUzbekistan&&<div className="mt-5"><ListingLocationPicker latitude={location.latitude} longitude={location.longitude} onChange={(latitude,longitude)=>setLocation({latitude,longitude})} /></div>}
        <label className="mt-5 block text-sm font-semibold">{t('Manzil','Адрес')}<input value={form.address} onChange={e=>update('address',e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm"><span className="font-semibold">{t('Tanlangan hudud:','Выбранный регион:')}</span> {allUzbekistan?t('Butun O‘zbekiston bo‘ylab','Весь Узбекистан'):form.district?`${form.city} / ${cleanDistrict(form.district)}`:form.city||t('Tanlanmagan','Не выбрано')}</div>
      </div>}
      {step===4&&<div><h2 className="text-xl font-bold">4. {t('Narx','Цена')}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">{t('Narx','Цена')}<input inputMode="numeric" value={form.price} onChange={e=>update('price',e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label><label className="text-sm font-semibold">{t('Valyuta','Валюта')}<select value={form.currency} onChange={e=>update('currency',e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="UZS">UZS</option><option value="USD">USD</option></select></label></div></div>}
      {step===5&&<ListingImageManager ref={imageManagerRef} listingId={listing.id} />}
      {step===6&&<div><h2 className="text-xl font-bold">6. {t('Tekshirish','Проверка')}</h2><div className="mt-5 rounded-2xl bg-slate-50 p-5 space-y-2 text-sm"><p><b>{t('Xizmat','Услуга')}:</b> {selected?.name_uz||form.taxonomy_code}</p><p><b>{t('Sarlavha','Заголовок')}:</b> {form.title}</p><p><b>{t('Hudud','Регион')}:</b> {allUzbekistan?t('Butun O‘zbekiston bo‘ylab','Весь Узбекистан'):`${form.city}${form.district?`, ${cleanDistrict(form.district)}`:''}`}</p><p><b>{t('Narx','Цена')}:</b> {form.price} {form.currency}</p></div></div>}
      <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={back} disabled={step===1||saving} className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold disabled:opacity-40">{t('Orqaga','Назад')}</button>{step<6?<button type="button" onClick={()=>void next()} disabled={saving} className="rounded-xl bg-slate-950 px-6 py-3 font-bold text-white disabled:opacity-50">{t('Davom etish','Продолжить')}</button>:<button type="button" onClick={()=>void save()} disabled={saving} className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white disabled:opacity-50">{saving?t('Saqlanmoqda...','Сохранение...'):t('Saqlash','Сохранить')}</button>}</div>
    </section>
  </div></main>
}
