'use client'

import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

const items = [
  { key: 'long', icon: '🏢', uz: 'Uzoq muddatga ijaraga', ru: 'Снять долгосрочно', subUz: 'Uzoq muddatli ijara takliflari', subRu: 'Квартиры и дома на длительный срок', href: '/listings?tab=rent&taxonomy=rent_long_term' },
  { key: 'daily', icon: '🗓️', uz: 'Kunlik ijaraga', ru: 'Снять посуточно', subUz: 'Kunlik va qisqa muddatli ijara', subRu: 'Жильё на сутки и короткий срок', href: '/listings?tab=rent&taxonomy=rent_daily' },
  { key: 'commercial', icon: '🏬', uz: 'Tijorat ko‘chmas mulki', ru: 'Коммерческая недвижимость', subUz: 'Ofis, do‘kon va boshqa tijorat obyektlari', subRu: 'Офисы, магазины и другие объекты', href: '/listings?tab=rent&type=commercial' },
  { key: 'dacha', icon: '🏡', uz: 'Dacha', ru: 'Дачи', subUz: 'Dam olish uchun uylar va hovlilar', subRu: 'Дачи и загородные дома для отдыха', href: '/listings?tab=rent&type=house&taxonomy=rent_daily' },
]

export default function RentMenuPage() {
  const { tx } = useI18n()

  return (
    <main className="min-h-screen bg-slate-950/70 px-4 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1180px] items-center justify-center">
        <section className="relative w-full rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
          <Link href="/" aria-label={tx('Yopish', 'Закрыть')} className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500 hover:bg-slate-200">×</Link>
          <div className="pr-12">
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{tx('Ijara', 'Аренда')}</h1>
            <p className="mt-2 text-sm text-slate-500">{tx('O‘zingizga mos ijara turini tanlang', 'Выберите подходящий вариант аренды')}</p>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <Link key={item.key} href={item.href} className="group flex min-h-[150px] items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-lg">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-3xl">{item.icon}</span>
                <span>
                  <span className="block text-lg font-black text-slate-900 group-hover:text-emerald-700">{tx(item.uz, item.ru)}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{tx(item.subUz, item.subRu)}</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-600">
            {tx('Kerakli bo‘limni tanlang — sizni mos e’lonlar ro‘yxatiga olib o‘tamiz.', 'Выберите нужный раздел — мы покажем подходящие объявления.')}
          </div>
        </section>
      </div>
    </main>
  )
}
