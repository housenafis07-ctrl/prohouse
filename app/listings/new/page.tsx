'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function NewListingPage() {
  const [ru,setRu]=useState(false)
  useEffect(()=>{setRu(window.localStorage.getItem('prohouse-lang')==='ru')},[])
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12"><div className="mx-auto max-w-4xl">
    <div className="mb-8 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">PROHOUSE</p><h1 className="mt-1 text-3xl font-bold text-slate-950">{ru?'Разместить объявление':'E’lon joylashtirish'}</h1><p className="mt-2 text-sm text-slate-500">{ru?'Выберите тип объявления':'E’lon turini tanlang'}</p></div><Link href="/account" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">{ru?'Личный кабинет':'Shaxsiy kabinet'}</Link></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Link href="/listings/new/property" className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-950 hover:shadow-md"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">🏠</div><h2 className="mt-5 text-xl font-bold text-slate-950">{ru?'Недвижимость':'Ko‘chmas mulk'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{ru?'Продажа, покупка, аренда и новостройки':'Sotish, sotib olish, ijara va yangi uylar'}</p><span className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">{ru?'Разместить объявление →':'E’lon joylashtirish →'}</span></Link>
      <Link href="/listings/new/service" className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">🛠️</div><h2 className="mt-5 text-xl font-bold text-slate-950">{ru?'Услуги':'Xizmatlar'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{ru?'Размещение профессиональных услуг для клиентов':'Professional xizmatlaringizni mijozlarga taklif qiling'}</p><span className="mt-5 inline-flex rounded-xl border border-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-700">{ru?'Разместить услугу →':'Xizmat e’lonini joylashtirish →'}</span></Link>
    </div>
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{ru?'Для услуг используется отдельная форма: услуга → данные → регион → цена → фото → проверка.':'Xizmatlar uchun alohida forma ishlatiladi: xizmat turi → ma’lumotlar → hudud → narx → rasmlar → tekshirish.'}</div>
  </div></main>
}
