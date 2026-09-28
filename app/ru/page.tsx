import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'RoyalHouse — недвижимость в Узбекистане',
  description: 'Поиск, продажа и аренда домов, квартир и другой недвижимости в Узбекистане на RoyalHouse.',
  alternates: { canonical: 'https://royalhouse.uz/ru', languages: { uz: 'https://royalhouse.uz/uz', ru: 'https://royalhouse.uz/ru', 'x-default': 'https://royalhouse.uz/uz' } },
  openGraph: { locale: 'ru_RU', url: 'https://royalhouse.uz/ru', siteName: 'RoyalHouse', title: 'RoyalHouse — недвижимость в Узбекистане', description: 'Находите жильё, размещайте объявления и изучайте предложения недвижимости на RoyalHouse.' },
}

export default function RuLanding() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-sm font-black tracking-widest text-emerald-600">ROYALHOUSE</p>
        <h1 className="mt-3 text-4xl font-black sm:text-6xl">Недвижимость в Узбекистане</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">Находите дома, квартиры и другую недвижимость, арендуйте или размещайте свои объявления.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/listings" className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white">Найти жильё</Link>
          <Link href="/register?next=%2Flistings%2Fnew" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black">Разместить объявление</Link>
          <Link href="/uz" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold">O‘zbekcha</Link>
        </div>
      </div>
    </main>
  )
}
