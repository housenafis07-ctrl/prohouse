'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { pickLocalized } from '@/lib/i18n'
import { useI18n } from '@/app/components/I18nProvider'

type Product={code:string;name:string;name_ru:string|null;description:string|null;description_ru:string|null;price_uzs:number;duration_days:number;product_type:string|null;audience:string;unit:string;quantity:number;badge:string|null;badge_ru:string|null;metadata?:Record<string, unknown>}
type Entitlement={id:string;product_code:string;status:string;quantity_remaining:number;starts_at:string|null;ends_at:string|null}

const planCodes = ['partner_start','partner_pro','partner_business']

const planFeatures = (code:string, lang:'uz'|'ru') => {
  const features = {
    partner_start: {
      uz: ['10 ta e’lon','Statistika','Oddiy hamkor profili','E’lonlarda yuqoriroq ko‘rinish'],
      ru: ['10 объявлений','Статистика','Базовый профиль партнёра','Более высокая позиция в объявлениях'],
    },
    partner_pro: {
      uz: ['30 ta e’lon','Tahlil','Ustuvor moderatsiya','Reklama vositalari','E’lonlarda yuqoriroq ko‘rinish'],
      ru: ['30 объявлений','Аналитика','Приоритетная модерация','Инструменты продвижения','Более высокая позиция в объявлениях'],
    },
    partner_business: {
      uz: ['100+ e’lon','Bir nechta xodim','Firma profili','Kengaytirilgan tahlil','Ustuvor yordam','E’lonlarda yuqoriroq ko‘rinish'],
      ru: ['100+ объявлений','Несколько сотрудников','Профиль компании','Расширенная аналитика','Приоритетная поддержка','Более высокая позиция в объявлениях'],
    },
  }
  return features[code as keyof typeof features]?.[lang] ?? []
}

export default function MonetizationPage(){
 const {lang,t}=useI18n()
 const locale = lang==='ru'?'ru':'uz'
 const [products,setProducts]=useState<Product[]>([]);const [entitlements,setEntitlements]=useState<Entitlement[]>([]);const [freeLimit,setFreeLimit]=useState(3);const [accountType,setAccountType]=useState<'individual'|'partner'|null>(null);const [loading,setLoading]=useState(true)
 const money=(v:number)=>`${new Intl.NumberFormat(lang==='ru'?'ru-RU':'uz-UZ').format(Number(v))} ${t('sum')}`
 const audienceLabel=(v:string)=>lang==='ru'?({individual:'Физические лица',partner:'Партнёры',all:'Все пользователи'} as Record<string,string>)[v]||v:({individual:'Jismoniy shaxslar',partner:'Hamkorlar',all:'Barcha foydalanuvchilar'} as Record<string,string>)[v]||v
 const unitLabel=(v:string)=>lang==='ru'?({listing:'объявление',day:'день',month:'месяц'} as Record<string,string>)[v]||v:({listing:'e’lon',day:'kun',month:'oy'} as Record<string,string>)[v]||v
 const typeLabel=(v:string|null)=>lang==='ru'?({extra_listing:'Дополнительное объявление',top:'Топ',up:'Поднять',highlight:'Выделение',premium:'Премиум',subscription:'Тариф'} as Record<string,string>)[v||'']||v||'Продукт':({extra_listing:'Qo‘shimcha e’lon',top:'Top',up:'Yuqoriga ko‘tarish',highlight:'Ajratish',premium:'Premium',subscription:'Tarif'} as Record<string,string>)[v||'']||v||'Mahsulot'
 useEffect(()=>{(async()=>{const db=createClient();const{data:{user}}=await db.auth.getUser();if(!user){window.location.href='/register?redirect=/account/monetization';return}const [{data:p},{data:e},{data:s},{data:profile}]=await Promise.all([db.from('monetization_products').select('code,name,name_ru,description,description_ru,price_uzs,duration_days,product_type,audience,unit,quantity,badge,badge_ru,metadata').eq('active',true).order('product_type').order('duration_days'),db.from('monetization_entitlements').select('id,product_code,status,quantity_remaining,starts_at,ends_at').order('created_at',{ascending:false}),db.from('listing_pricing_settings').select('individual_free_listing_limit').eq('id',1).maybeSingle(),db.from('profiles').select('account_type').eq('id',user.id).maybeSingle()]);setProducts((p||[]) as Product[]);setEntitlements((e||[]) as Entitlement[]);setFreeLimit(Number(s?.individual_free_listing_limit??3));setAccountType(profile?.account_type==='partner'?'partner':'individual');setLoading(false)})()},[])
 const plans=useMemo(()=>products.filter(p=>planCodes.includes(p.code)),[products])
 const otherProducts=useMemo(()=>products.filter(p=>!planCodes.includes(p.code)),[products])
 const activePlan=useMemo(()=>entitlements.find(e=>planCodes.includes(e.product_code)&&e.status==='active'&&(!e.ends_at||new Date(e.ends_at)>new Date())),[entitlements])
 const visibleFreeLimit=accountType==='partner'?5:freeLimit
 const freeLimitTitle=accountType==='partner'?(lang==='ru'?'Бесплатный лимит партнёра':'Hamkorning bepul limiti'):(lang==='ru'?'Бесплатный лимит физлица':'Jismoniy shaxs bepul limiti')
 if(loading)return <main className="min-h-screen bg-slate-50 p-8 text-center">{t('loading')}</main>
 return <main className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-6xl"><Link href="/account" className="text-sm font-bold text-emerald-700">← {t('account')}</Link>

 <header className="relative mt-4 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-7 text-white shadow-xl sm:p-10">
  <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
  <div className="relative max-w-3xl"><span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black tracking-wide text-emerald-200">ROYALHOUSE PARTNER</span><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{lang==='ru'?'Больше объявлений. Больше клиентов. Больше возможностей.':'Ko‘proq e’lon. Ko‘proq mijoz. Ko‘proq imkoniyat.'}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{lang==='ru'?'Выберите тариф для роста бизнеса. Продвигайте объявления, анализируйте результаты и получайте больше внимания покупателей.':'Biznesingizni kengaytirish uchun mos tarifni tanlang. E’lonlaringizni faolroq targ‘ib qiling, natijalarni tahlil qiling va ko‘proq mijozga chiqing.'}</p></div>
  <div className="relative mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="text-2xl">📈</div><b className="mt-2 block text-sm">{lang==='ru'?'Больше охвата':'Ko‘proq ko‘rinish'}</b><span className="mt-1 block text-xs text-slate-300">{lang==='ru'?'Ваши объявления получают преимущество':'E’lonlaringiz oddiy e’lonlardan ustun ko‘rinadi'}</span></div><div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="text-2xl">🎯</div><b className="mt-2 block text-sm">{lang==='ru'?'Больше инструментов':'Ko‘proq vosita'}</b><span className="mt-1 block text-xs text-slate-300">{lang==='ru'?'Продвижение и аналитика':'Targ‘ibot va tahlil imkoniyatlari'}</span></div><div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="text-2xl">🤝</div><b className="mt-2 block text-sm">{lang==='ru'?'Для профессионалов':'Professional hamkorlar uchun'}</b><span className="mt-1 block text-xs text-slate-300">{lang==='ru'?'Тарифы для любого масштаба':'Har qanday biznes ko‘lami uchun'}</span></div></div>
 </header>

 <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="text-xs font-bold text-slate-400">{lang==='ru'?'Ваш тариф':'Sizning tarifingiz'}</span><b className="mt-1 block text-xl">{activePlan?activePlan.product_code.replace('partner_','').toUpperCase():(lang==='ru'?'Не выбран':'Tanlanmagan')}</b></div><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="text-xs font-bold text-slate-400">{freeLimitTitle}</span><b className="mt-1 block text-xl">{visibleFreeLimit} {lang==='ru'?'объявления':'ta e’lon'}</b></div><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="text-xs font-bold text-slate-400">{lang==='ru'?'Оплата':'To‘lov'}</span><b className="mt-1 block text-xl">Payme · Click</b></div></div>

 <section className="mt-10"><div className="text-center"><span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">{lang==='ru'?'ДЛЯ ПАРТНЁРОВ':'HAMKORLAR UCHUN'}</span><h2 className="mt-2 text-3xl font-black tracking-tight">{lang==='ru'?'Выберите свой уровень':'O‘zingizga mos tarifni tanlang'}</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">{lang==='ru'?'Начните с START и переходите на PRO или BUSINESS, когда бизнес растёт.':'START bilan boshlang va biznesingiz kengaygani sari PRO yoki BUSINESS tarifiga o‘ting.'}</p></div>
 <div className="mt-7 grid gap-5 lg:grid-cols-3">{plans.map(p=>{const isPro=p.code==='partner_pro';const isBusiness=p.code==='partner_business';const limit=String(p.metadata?.listing_limit_label||p.metadata?.listing_limit||'—');return <article key={p.code} className={`relative flex flex-col overflow-hidden rounded-[2rem] border bg-white shadow-lg transition duration-200 hover:-translate-y-1 hover:shadow-xl ${isPro?'border-emerald-400 ring-2 ring-emerald-100':'border-slate-200'}`}>
  {isPro&&<div className="bg-emerald-600 px-5 py-2 text-center text-xs font-black uppercase tracking-wider text-white">⭐ {lang==='ru'?'САМЫЙ ПОПУЛЯРНЫЙ':'ENG KO‘P TANLANADI'}</div>}
  <div className="flex flex-1 flex-col p-6 sm:p-7"><div className="flex items-start justify-between gap-3"><div><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${isPro?'bg-emerald-100 text-emerald-700':isBusiness?'bg-violet-100 text-violet-700':'bg-slate-100 text-slate-700'}`}>{p.name}</span><h3 className="mt-5 text-4xl font-black tracking-tight">{money(p.price_uzs)}</h3><span className="text-sm font-bold text-slate-400">/ {lang==='ru'?'месяц':'oy'}</span></div><div className="rounded-2xl bg-slate-50 px-3 py-2 text-right"><b className="block text-xl">{limit}</b><span className="text-[11px] font-bold text-slate-400">{lang==='ru'?'объявлений':'e’lon'}</span></div></div>
  <p className="mt-4 min-h-12 text-sm leading-6 text-slate-500">{pickLocalized(lang,p.description,p.description_ru)}</p>
  <div className="my-5 h-px bg-slate-100" />
  <ul className="space-y-3 text-sm text-slate-700">{planFeatures(p.code,locale).map((feature,index)=><li key={`${p.code}-${index}`}>✓ {index===0?<b>{feature}</b>:feature}</li>)}</ul>
  <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">{lang==='ru'?'Тариф предоставляет больше объявлений, возможностей продвижения и управления. Статус надёжного профиля предоставляется отдельно после проверки.':'Tarif ko‘proq e’lon, targ‘ibot va boshqaruv imkoniyatlarini beradi. Ishonchli profil maqomi esa alohida tekshiruvdan so‘ng beriladi.'}</div>
  <Link href={`/account/monetization/checkout?product=${encodeURIComponent(p.code)}`} className={`mt-6 block w-full rounded-2xl px-4 py-3.5 text-center text-sm font-black text-white shadow-sm transition hover:scale-[1.01] ${isPro?'bg-emerald-600 hover:bg-emerald-700':isBusiness?'bg-violet-600 hover:bg-violet-700':'bg-slate-900 hover:bg-slate-800'}`}>{activePlan?.product_code===p.code?t('Tarifni yangilash','Обновить тариф'):isPro?t('PRO tarifini tanlash →','Выбрать PRO →'):t('Tanlash va to‘lash →','Выбрать и оплатить →')}</Link>
  </div></article>})}</div></section>

 <section className="mt-8 rounded-3xl border border-emerald-100 bg-emerald-50 p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-black text-slate-900">🚀 {lang==='ru'?'Хотите больше клиентов?':'Ko‘proq mijoz xohlaysizmi?'}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{lang==='ru'?'Выберите PRO, если вам нужны продвижение, аналитика и до 30 объявлений.':'Agar sizga targ‘ibot, tahlil va 30 tagacha e’lon kerak bo‘lsa, PRO tarifini tanlang.'}</p></div><Link href="/account/monetization/checkout?product=partner_pro" className="shrink-0 rounded-2xl bg-emerald-600 px-6 py-3 text-center text-sm font-black text-white shadow-sm hover:bg-emerald-700">{lang==='ru'?'Выбрать PRO':'PRO’ni tanlash →'}</Link></div></section>

 <section className="mt-10"><div className="flex items-end justify-between"><div><h2 className="text-xl font-black">{lang==='ru'?'Дополнительные услуги':'Qo‘shimcha monetizatsiya'}</h2><p className="mt-1 text-sm text-slate-500">{lang==='ru'?'TOP, UP, Выделение и другие услуги.':'TOP, UP, Ajratish va boshqa xizmatlar.'}</p></div><span className="text-sm text-slate-400">{otherProducts.length} {lang==='ru'?'продуктов':'ta mahsulot'}</span></div><div className="mt-4 grid gap-4 md:grid-cols-3">{otherProducts.map(p=><article key={p.code} className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{pickLocalized(lang,p.badge,p.badge_ru)||typeLabel(p.product_type)}</span><span className="text-xs font-bold text-slate-400">{audienceLabel(p.audience)}</span></div><h3 className="mt-4 text-lg font-black">{pickLocalized(lang,p.name,p.name_ru)}</h3><p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">{pickLocalized(lang,p.description,p.description_ru)||'—'}</p><div className="mt-5 flex items-end justify-between"><b className="text-xl">{money(p.price_uzs)}</b><span className="text-xs font-bold text-slate-400">{p.product_type==='extra_listing' ? (lang === 'ru' ? `${p.quantity} объявлений · разово` : `${p.quantity} ta e’lon · bir martalik`) : `${p.duration_days} ${unitLabel(p.unit)}`}</span></div><Link href={`/account/monetization/checkout?product=${encodeURIComponent(p.code)}`} className="mt-4 block w-full rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-black text-white">{t('buy')}</Link></article>)}</div></section>

 <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{lang==='ru'?'Доступы':'Tariflar va huquqlar'}</h2>{entitlements.length===0?<p className="mt-3 text-sm text-slate-500">{lang==='ru'?'У вас пока нет активных доступов.':'Sizda hozircha faol tarif yo‘q.'}</p>:<div className="mt-4 space-y-3">{entitlements.map(e=><div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 text-sm"><div><b>{e.product_code}</b><span className="ml-2 text-slate-500">{e.status}</span></div><span className="font-bold">{e.ends_at ? new Date(e.ends_at).toLocaleDateString(lang==='ru'?'ru-RU':'uz-UZ') : '∞'}</span></div>)}</div>}</section></div></main>
}
