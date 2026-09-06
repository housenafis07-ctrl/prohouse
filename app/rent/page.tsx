'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Lang = 'uz' | 'ru'

const items = [
  { key: 'long', icon: '🏢', uz: 'Uzoq muddatga ijaraga', ru: 'Снять долгосрочно', subUz: 'Uzoq muddatli ijara takliflari', subRu: 'Квартиры и дома на длительный срок', href: '/listings?tab=rent' },
  { key: 'daily', icon: '🗓️', uz: 'Kunlik ijaraga', ru: 'Снять посуточно', subUz: 'Kunlik va qisqa muddatli ijara', subRu: 'Жильё на сутки и короткий срок', href: '/listings?tab=daily' },
  { key: 'commercial', icon: '🏬', uz: 'Tijorat ko‘chmas mulki', ru: 'Коммерческая недвижимость', subUz: 'Ofis, do‘kon va boshqa tijorat obyektlari', subRu: 'Офисы, магазины и другие объекты', href: '/listings?tab=rent&type=commercial' },
  { key: 'dacha', icon: '🏡', uz: 'Dacha', ru: 'Дачы', subUz: 'Dam olish uchun uylar va hovlilar', subRu: 'Дачи и загородные дома для отдыха', href: '/listings?tab=rent&type=house' },
]

export default function RentMenuPage() {
  const [lang, setLang] = useState<Lang>('uz')

  useEffect(() => {
    const saved = localStorage.getItem('prohouse-lang')
    if (saved === 'ru') setLang('ru')
  }, [])

  const ru = lang === 'ru'

  return (
    <main className="min-h-screen bg-slate-950/70 px-4 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1180px] items-center justify-center">
        <section className="relative w-full rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
          <Link href="/" aria-label={ru ? 'Закрыть' : 'Yopish'} className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500 hover:bg-slate-200">×</Link>
          <div className="pr-12">
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{ru ? 'Аренда' : 'Ijara'}</h1>
            <p className="mt-2 text-sm text-slate-500">{ru ? 'Выберите подходящий вариант аренды' : 'O‘zingizga mos ijara turini tanlang'}</p>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <Link key={item.key} href={item.href} className="group flex min-h-[150px] items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-lg">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-3xl">{item.icon}</span>
                <span>
                  <span className="block text-lg font-black text-slate-900 group-hover:text-emerald-700">{ru ? item.ru : item.uz}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{ru ? item.subRu : item.subUz}</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-600">
            {ru ? 'Kerakli bo‘limni tanlang — sizni mos e’lonlar ro‘yxatiga olib o‘tamiz.' : 'Kerakli bo‘limni tanlang — sizni mos e’lonlar ro‘yxatiga olib o‘tamiz.'}
          </div>
        </section>
      </div>
    </main>
  )
}
