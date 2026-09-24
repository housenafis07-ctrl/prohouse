'use client'

import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

export default function NewListingPage() {
  const { tx } = useI18n()
  const telegramUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, '')

  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12"><div className="mx-auto max-w-4xl">
    <div className="mb-8 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">ROYALHOUSE</p><h1 className="mt-1 text-3xl font-bold text-slate-950">{tx('E’lon joylashtirish','Разместить объявление')}</h1><p className="mt-2 text-sm text-slate-500">{tx('E’lon turini tanlang','Выберите тип объявления')}</p></div><Link href="/account" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">{tx('Shaxsiy kabinet','Личный кабинет')}</Link></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Link href="/listings/new/property" className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-950 hover:shadow-md"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">🏠</div><h2 className="mt-5 text-xl font-bold text-slate-950">{tx('Ko‘chmas mulk','Недвижимость')}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{tx('Sotish, sotib olish, ijara va yangi uylar','Продажа, покупка, аренда и новостройки')}</p><span className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">{tx('E’lon joylashtirish →','Разместить объявление →')}</span></Link>
      <Link href="/listings/new/service" className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">🛠️</div><h2 className="mt-5 text-xl font-bold text-slate-950">{tx('Xizmatlar','Услуги')}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{tx('Professional xizmatlaringizni mijozlarga taklif qiling','Размещение профессиональных услуг для клиентов')}</p><span className="mt-5 inline-flex rounded-xl border border-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-700">{tx('Xizmat e’lonini joylashtirish →','Разместить услугу →')}</span></Link>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900"><b>{tx('Dacha e’lonlari uchun 15% komissiya','Комиссия 15% для объявлений о дачах')}</b><p className="mt-1 text-amber-800">{tx('Dacha joylashtirishda Royalhouse komissiyasi 15% qilib belgilanadi. Bronlash kalendari va bo‘sh kunlarni boshqarish e’lon bilan birga ishlaydi.','Для дач комиссия Royalhouse составляет 15%. Вместе с объявлением работает календарь бронирований и управление свободными датами.')}</p></div>
      {telegramUsername && <a href={`https://t.me/${telegramUsername}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm text-sky-900 hover:border-sky-300"><b>{tx('Telegram bot orqali ham joylashtirish mumkin','Можно размещать объявления и через Telegram-бот')}</b><p className="mt-1 text-sky-800">{tx('Botdan Royalhouse shaxsiy kabinetiga o‘tib, keyin boshqa funksiyalardan ham foydalanasiz.','Из бота можно перейти в личный кабинет Royalhouse и дальше пользоваться всеми функциями.')}</p></a>}
    </div>
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{tx('Xizmatlar uchun alohida forma ishlatiladi: xizmat turi → ma’lumotlar → hudud → narx → rasmlar → tekshirish.','Для услуг используется отдельная форма: услуга → данные → регион → цена → фото → проверка.')}</div>
  </div></main>
}
