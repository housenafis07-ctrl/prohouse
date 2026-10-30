'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

type Realtor = {
  id: string; user_id: string; display_name: string; phone: string | null; bio: string | null
  avatar_url: string | null; experience_years: number | null; verification_status: string
  rating: number | null; reviews_count: number | null; agency_name: string | null
  service_areas: string[] | null; agency_profiles?: { name: string; slug: string } | null
}
type Listing = {
  id: string; title: string | null; title_ru?: string | null; listing_type: string | null
  price: number | null; currency: string | null; area_m2: number | null; rooms: number | null
  floor: number | null; city: string | null; district: string | null
  primary_image?: { image_url: string } | null
}
const copy = {
  uz: {
    back:'Rieltorlar', verified:'Profil tasdiqlangan', private:'Mustaqil rieltor', experience:'Tajriba', years:'yil',
    listings:'E’lonlar', active:'faol', deals:'Sharhlar', about:'Rieltor haqida', aboutSub:'Mutaxassis haqida muhim ma’lumotlar',
    more:'Batafsil ko‘rish', less:'Yopish', areas:'Xizmat hududlari', agency:'Agentlik', contact:'Rieltorga murojaat qiling',
    showPhone:'Telefon raqamini ko‘rsatish', call:'Qo‘ng‘iroq qilish', ask:'Rieltordan so‘rang', placeholder:'Xabaringizni yozing',
    send:'Yuborish', buy:'Uy sotib olish', sell:'Uy sotish', rentOut:'Ijaraga berish', rent:'Uy ijaraga olish',
    card:'Raqamli vizitka', open:'Vizitka ma’lumotlarini nusxalash', all:'Barcha rieltorlar', objects:'Rieltor obyektlari',
    sale:'Sotuv', rentTab:'Ijara', tiles:'Plyitka', map:'Xaritada', moreObjects:'Yana obyektlarni ko‘rish',
    noListings:'Hozircha faol e’lonlar yo‘q.', reviews:'Mijozlar bahosi', based:'baholar asosida',
    noReviews:'Hozircha mijozlar bahosi mavjud emas.', professional:'Professional ma’lumotlar',
    expLabel:'Ko‘chmas mulk sohasidagi tajriba', areaLabel:'Faoliyat hududlari', verifiedText:'RoyalHouse tomonidan tekshirilgan profil',
    notFound:'Rieltor topilmadi.', loading:'Profil yuklanmoqda…', noPhone:'Telefon ko‘rsatilmagan',
    chatUnavailable:'Xabar yuborish funksiyasi hozircha mavjud emas. Telefon orqali bog‘laning.',
    noPhoto:'Rasm mavjud emas', rooms:'xonali', floor:'qavat', mapOpen:'E’lonlar xaritasini ochish',
    phoneHidden:'Raqam maxfiy. Ko‘rish uchun tugmani bosing.', sendError:'Xabar yuborilmadi. Qayta urinib ko‘ring.', sent:'Xabaringiz yuborildi. Chat ochilmoqda…', loginRequired:'Xabar yuborish uchun tizimga kiring.',
    tariffs:'Rieltor tariflari', priceRequest:'Narx so‘rov bo‘yicha'
  },
  ru: {
    back:'Риелторы', verified:'Профиль подтверждён', private:'Частный риелтор', experience:'Опыт', years:'лет',
    listings:'Объявления', active:'активно', deals:'Отзывы', about:'О риелторе', aboutSub:'Важная информация о специалисте',
    more:'Подробнее', less:'Свернуть', areas:'Районы работы', agency:'Агентство', contact:'Связаться с риелтором',
    showPhone:'Показать телефон', call:'Позвонить', ask:'Спросите у риелтора', placeholder:'Ваше сообщение',
    send:'Отправить', buy:'Купить жильё', sell:'Продать жильё', rentOut:'Сдать жильё', rent:'Арендовать жильё',
    card:'Цифровая визитка', open:'Скопировать визитку', all:'Все риелторы', objects:'Объекты риелтора',
    sale:'Продажа', rentTab:'Аренда', tiles:'Плиткой', map:'На карте', moreObjects:'Показать ещё объекты',
    noListings:'Пока нет активных объявлений.', reviews:'Оценки клиентов', based:'оценок',
    noReviews:'Пока нет оценок клиентов.', professional:'Профессиональная информация',
    expLabel:'Опыт в недвижимости', areaLabel:'Районы деятельности', verifiedText:'Профиль проверен RoyalHouse',
    notFound:'Риелтор не найден.', loading:'Загрузка профиля…', noPhone:'Телефон не указан',
    chatUnavailable:'Отправка сообщений пока недоступна. Свяжитесь по телефону.',
    noPhoto:'Нет фотографии', rooms:'-комн.', floor:'эт.', mapOpen:'Открыть карту объявлений',
    phoneHidden:'Номер скрыт. Нажмите кнопку, чтобы увидеть его.', sendError:'Не удалось отправить сообщение. Попробуйте ещё раз.', sent:'Сообщение отправлено. Открываем чат…', loginRequired:'Войдите в аккаунт, чтобы отправить сообщение.',
    tariffs:'Тарифы риелторов', priceRequest:'Цена по запросу'
  }
}
function money(value:number|null,currency:string|null,ru:boolean) {
  if(value==null) return ru ? 'Цена по запросу' : 'Narx so‘rov bo‘yicha'
  return (currency==='USD'?'$':'') + new Intl.NumberFormat(ru?'ru-RU':'uz-UZ').format(value) + (currency==='USD'?'':(' '+(currency||'UZS')))
}
export default function RealtorProfile() {
  const params=useParams<{id:string}>()
  const router=useRouter()
  const {lang}=useI18n()
  const ru=lang==='ru'
  const t=ru?copy.ru:copy.uz
  const [r,setR]=useState<Realtor|null>(null)
  const [listings,setListings]=useState<Listing[]>([])
  const [loading,setLoading]=useState(true)
  const [phoneVisible,setPhoneVisible]=useState(false)
  const [aboutOpen,setAboutOpen]=useState(false)
  const [tab,setTab]=useState<'sale'|'rent'>('sale')
  const [view,setView]=useState<'tiles'|'map'>('tiles')
  const [question,setQuestion]=useState('')
  const [sent,setSent]=useState(false)
  const [sending,setSending]=useState(false)
  const [messageError,setMessageError]=useState('')

  useEffect(()=>{
    let alive=true
    const load=async()=>{
      if(!params?.id)return
      setLoading(true)
      const db=createClient()
      const {data,error}=await db.from('realtor_profiles')
        .select('id,user_id,display_name,phone,bio,avatar_url,experience_years,verification_status,rating,reviews_count,agency_name,service_areas,agency_profiles(name,slug)')
        .eq('id',params.id).maybeSingle()
      if(!alive)return
      if(error||!data){setR(null);setLoading(false);return}
      setR(data as Realtor)
      try {
        const response=await fetch('/api/listings/search?realtor='+encodeURIComponent(params.id)+'&limit=48',{cache:'no-store'})
        const result=await response.json()
        if(alive&&response.ok)setListings((result.data||[]) as Listing[])
      } catch { if(alive)setListings([]) }
      if(alive)setLoading(false)
    }
    void load()
    return ()=>{alive=false}
  },[params?.id])

  const sale=useMemo(()=>listings.filter(x=>x.listing_type==='sale'||x.listing_type==='new_building'),[listings])
  const rent=useMemo(()=>listings.filter(x=>x.listing_type==='rent'||x.listing_type==='daily'),[listings])
  const visible=tab==='sale'?sale:rent
  const rating=Number(r?.rating||0)
  const count=Number(r?.reviews_count||0)
  const experience=Number(r?.experience_years||0)
  const phone=r?.phone||''

  if(loading)return <main className="min-h-screen bg-[#eef0f2] p-6"><div className="mx-auto max-w-6xl rounded-3xl bg-white p-12 text-center">{t.loading}</div></main>
  if(!r)return <main className="min-h-screen bg-[#eef0f2] p-6"><div className="mx-auto max-w-6xl rounded-3xl bg-white p-12 text-center">{t.notFound}</div></main>

  const phoneButton=<button onClick={()=>setPhoneVisible(true)} disabled={!phone} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-center font-bold text-white disabled:opacity-50">{t.showPhone}<span className="mt-1 block text-xs font-medium text-emerald-100">{phone?t.phoneHidden:t.noPhone}</span></button>
  return <main className="min-h-screen bg-[#eef0f2] text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-4">
        <Link href="/realtors" className="text-sm font-semibold text-emerald-700">← {t.back}</Link>
        <Link href="/" className="text-xl font-black">Royal<span className="text-emerald-600">House</span>.uz</Link>
        <Link href="/realtors/cabinet" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold">{ru?'Кабинет':'Kabinet'}</Link>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1280px] gap-2 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-2">
        <section className="rounded-[22px] bg-white p-5 sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_245px]">
            <div className="min-w-0">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-4 ring-slate-50 sm:h-32 sm:w-32">
                  {r.avatar_url?<img src={r.avatar_url} alt={r.display_name} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-4xl font-bold text-slate-400">{r.display_name.slice(0,1)}</div>}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-semibold text-cyan-800">{t.private}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold sm:text-[28px]">{r.display_name}</h1><span className="text-lg font-bold text-amber-400">★ <span className="text-slate-800">{rating?rating.toFixed(1):'—'}</span></span></div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {r.verification_status==='verified'&&<span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">✓ {t.verified}</span>}
                    {r.agency_profiles?.name&&<Link href={'/agencies/'+r.agency_profiles.slug} className="text-sm text-blue-600 hover:underline">{r.agency_profiles.name}</Link>}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div className="rounded-xl bg-[#f3f4f5] p-3"><div className="text-xl font-bold">{experience} {t.years}</div><div className="text-xs text-slate-500">{t.experience}</div></div>
                    <div className="rounded-xl bg-[#f3f4f5] p-3"><div className="text-xl font-bold">{count}</div><div className="text-xs text-slate-500">{t.deals}</div></div>
                    <div className="col-span-2 rounded-xl bg-[#f3f4f5] p-3 sm:col-span-1"><div className="text-xl font-bold">{listings.length}</div><div className="text-xs text-slate-500">{t.listings} · {t.active}</div></div>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-[#f3f4f5] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{t.about}</h2><span className="text-xs text-slate-500">{t.verifiedText}</span></div>
                <p className={'mt-2 whitespace-pre-line text-sm leading-6 text-slate-700 '+(aboutOpen?'':'line-clamp-4')}>{r.bio||(ru?'Профессиональные услуги в сфере недвижимости.':'Ko‘chmas mulk bo‘yicha professional xizmat.')}</p>
                {r.bio&&r.bio.length>180&&<button onClick={()=>setAboutOpen(!aboutOpen)} className="mt-2 text-sm font-semibold text-blue-600">{aboutOpen?t.less:t.more}</button>}
              </div>
            </div>
            <div className="hidden rounded-2xl border border-slate-100 p-4 xl:flex xl:flex-col xl:justify-center xl:gap-3">
              <div className="text-sm text-slate-500">{t.contact}</div>
              {phoneVisible&&phone?<a href={'tel:'+phone.replace(/[^+\\d]/g,'')} className="rounded-xl bg-emerald-600 px-4 py-4 text-center font-bold text-white">{phone}<span className="mt-1 block text-xs">{t.call}</span></a>:phoneButton}
              <button onClick={()=>document.getElementById('ask-realtor')?.scrollIntoView({behavior:'smooth',block:'center'})} className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold">{t.ask}</button>
              <p className="text-center text-xs text-slate-500">{r.agency_name||t.private}</p>
            </div>
          </div>
        </section>
        <section className="rounded-[22px] bg-white p-5 sm:p-6">
          <button onClick={()=>setAboutOpen(!aboutOpen)} className="flex w-full items-center justify-between text-left"><span><span className="block text-xl font-bold">{t.professional}</span><span className="mt-1 block text-sm text-slate-500">{t.aboutSub}</span></span><span className="rounded-lg bg-slate-100 px-3 py-2">{aboutOpen?'⌃':'⌄'}</span></button>
          {aboutOpen&&<div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <div><div className="text-xs text-slate-500">{t.expLabel}</div><div className="mt-1 font-semibold">{experience} {t.years}</div></div>
            <div><div className="text-xs text-slate-500">{t.areaLabel}</div><div className="mt-1 font-semibold">{r.service_areas?.join(', ')||'—'}</div></div>
            {r.agency_profiles?.name&&<div><div className="text-xs text-slate-500">{t.agency}</div><Link href={'/agencies/'+r.agency_profiles.slug} className="mt-1 inline-block font-semibold text-blue-600">{r.agency_profiles.name}</Link></div>}
          </div>}
        </section>
        <section className="rounded-[22px] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{t.reviews} <span className="ml-1 text-slate-500">{count}</span></h2><span className="text-sm text-slate-500">{t.based}</span></div>
          <div className="mt-5 flex items-center gap-5"><div className="flex items-center gap-2"><span className="text-4xl text-amber-400">★</span><span className="text-4xl font-bold">{rating?rating.toFixed(1):'—'}</span></div><div><div className="text-sm font-semibold">{ru?'Общий рейтинг':'Umumiy reyting'}</div><div className="mt-1 text-xs text-slate-500">{count} {ru?'оценок':'ta baho'}</div></div></div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{count?rating.toFixed(1)+' / 5':t.noReviews}</div>
        </section>
        <section className="rounded-[22px] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{t.objects} <span className="ml-1 text-slate-500">{listings.length}</span></h2><div className="flex gap-2"><button onClick={()=>setView('tiles')} className={'rounded-lg border px-3 py-2 text-sm '+(view==='tiles'?'border-emerald-600 text-emerald-700':'border-slate-200 text-slate-500')}>▦ {t.tiles}</button><button onClick={()=>setView('map')} className={'rounded-lg border px-3 py-2 text-sm '+(view==='map'?'border-emerald-600 text-emerald-700':'border-slate-200 text-slate-500')}>⌖ {t.map}</button></div></div>
          <div className="mt-4 flex gap-6 border-b border-slate-200"><button onClick={()=>setTab('sale')} className={'border-b-2 px-3 pb-3 text-sm font-semibold '+(tab==='sale'?'border-slate-900':'border-transparent text-slate-500')}>{t.sale} <span className="text-slate-400">{sale.length}</span></button><button onClick={()=>setTab('rent')} className={'border-b-2 px-3 pb-3 text-sm font-semibold '+(tab==='rent'?'border-slate-900':'border-transparent text-slate-500')}>{t.rentTab} <span className="text-slate-400">{rent.length}</span></button></div>
          {view==='map'?<div className="mt-5 rounded-xl bg-slate-50 p-6 text-center"><Link href={'/listings?realtor='+r.id+'&view=map'} className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-emerald-700">{t.mapOpen} →</Link></div>:visible.length?<div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.slice(0,6).map(item=><Link key={item.id} href={'/listings/'+item.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-100 transition hover:shadow-md">
              <div className="aspect-[4/3] bg-slate-100">{item.primary_image?.image_url?<img src={item.primary_image.image_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-sm text-slate-400">{t.noPhoto}</div>}</div>
              <div className="p-3"><div className="font-bold">{money(item.price,item.currency,ru)}</div><div className="mt-1 truncate text-sm font-medium">{ru?item.title_ru||item.title:item.title}</div><div className="mt-2 text-xs text-slate-500">{[item.rooms?item.rooms+t.rooms:null,item.area_m2?item.area_m2+' m²':null,item.floor?item.floor+' '+t.floor:null].filter(Boolean).join(' · ')}</div><div className="mt-1 truncate text-xs text-slate-500">{[item.city,item.district].filter(Boolean).join(', ')}</div></div>
            </Link>)}
          </div>:<div className="mt-5 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">{t.noListings}</div>}
          {listings.length>6&&<Link href={'/listings?realtor='+r.id} className="mt-5 inline-block rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold">{t.moreObjects} →</Link>}
        </section>
      </div>
      <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start">
        <section id="ask-realtor" className="rounded-[22px] bg-white p-5">
          {phoneVisible&&phone?<a href={'tel:'+phone.replace(/[^+\\d]/g,'')} className="block rounded-xl bg-emerald-600 px-4 py-3 text-center font-bold text-white">{phone}<span className="mt-1 block text-xs">{t.call}</span></a>:phoneButton}
          <h2 className="pt-4 text-lg font-bold">{t.ask}</h2>
          <form onSubmit={async event=>{event.preventDefault();const value=question.trim();if(!value||sending)return;setSending(true);setMessageError('');setSent(false);try{const response=await fetch('/api/realtors/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({realtorId:r.id,message:value})});const result=await response.json().catch(()=>({}));if(response.status===401){setMessageError(t.loginRequired);return}if(!response.ok||!result.conversationId)throw new Error(result.error||t.sendError);setSent(true);router.push('/chat?conversationId='+encodeURIComponent(result.conversationId))}catch(error){setMessageError(error instanceof Error?error.message:t.sendError)}finally{setSending(false)}}} className="mt-2">
            <textarea value={question} onChange={event=>{setQuestion(event.target.value);setSent(false);setMessageError('')}} rows={3} maxLength={2000} placeholder={t.placeholder} className="w-full resize-none rounded-xl bg-[#e8eff4] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"/>
            <button type="submit" disabled={!question.trim()||sending} className="mt-2 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold disabled:opacity-50">{sending?(ru?'Отправка…':'Yuborilmoqda…'):t.send} →</button>
            {messageError&&<p className="mt-2 text-xs text-red-600">{messageError}</p>}
            {sent&&<p className="mt-2 text-xs text-emerald-700">{t.sent}</p>}
          </form>
          <div className="mt-3 flex flex-wrap gap-2">{[t.buy,t.sell,t.rentOut,t.rent].map(label=><button key={label} onClick={()=>{setQuestion(label);setSent(false)}} className="rounded-lg border border-slate-300 px-3 py-2 text-xs">{label}</button>)}</div>
        </section>
        <section className="rounded-[22px] bg-white p-5"><div className="flex items-center justify-between"><span className="font-semibold">{t.card}</span><span className="text-xl text-emerald-500">▣</span></div><button onClick={()=>{const value=r.display_name+'\n'+phone+'\nhttps://royalhouse.uz/realtors/'+r.id;void navigator.clipboard?.writeText(value)}} className="mt-4 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold">{t.open}</button></section>
        <Link href="/realtors" className="flex items-center justify-between rounded-[22px] bg-white p-5 text-sm font-semibold"><span>{t.all}</span><span className="text-xl text-slate-400">›</span></Link>
        <section className="rounded-[22px] bg-white p-5"><div className="text-xs font-semibold text-blue-600">{ru?'Для риелторов':'Rieltorlar uchun'}</div><h3 className="mt-3 font-semibold">{ru?'Развивайте профиль на RoyalHouse':'RoyalHouse’da profilingizni rivojlantiring'}</h3><p className="mt-2 text-sm text-slate-500">{ru?'Профессиональный профиль помогает клиентам узнать о вашей работе.':'Professional profil mijozlarga tajribangiz va e’lonlaringizni ko‘rsatadi.'}</p><Link href="/realtors/tariffs" className="mt-3 inline-block text-sm font-semibold text-blue-600">{t.tariffs} →</Link></section>
      </aside>
    </div>
  </main>
}
