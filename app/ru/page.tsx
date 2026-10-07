import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'RoyalHouse — недвижимость в Узбекистане',
  description: 'Поиск, продажа и аренда домов, квартир и другой недвижимости в Узбекистане на RoyalHouse.',
  alternates: { canonical: 'https://royalhouse.uz/ru', languages: { uz: 'https://royalhouse.uz/uz', ru: 'https://royalhouse.uz/ru', 'x-default': 'https://royalhouse.uz/' } },
  openGraph: { locale: 'ru_RU', url: 'https://royalhouse.uz/ru', siteName: 'RoyalHouse', title: 'RoyalHouse — недвижимость в Узбекистане', description: 'Находите жильё, размещайте объявления и изучайте предложения недвижимости на RoyalHouse.' },
}

export default function RuLanding() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-sm font-black tracking-widest text-emerald-600">ROYALHOUSE</p>
        <h1 className="mt-3 text-4xl font-black sm:text-6xl">Недвижимость в Узбекистане</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">Находите дома, квартиры и другую недвижимость, арендуйте или размещайте свои объявления.</p>
        <section className="mt-10 max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black">Недвижимость в Ташкенте и Узбекистане</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            На RoyalHouse можно найти квартиры, дома, частные дома, земельные участки и другие объекты недвижимости в Ташкенте и по Узбекистану.
            Здесь доступны покупка, аренда, новостройки и полезная информация об ипотеке.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
            <Link href="/listings?tab=sale" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Квартиры и дома</Link>
            <Link href="/listings?tab=rent" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Аренда</Link>
            <Link href="/listings?tab=sale&type=new_building" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Новостройки</Link>
            <Link href="/ipoteka/kalkulyator" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Ипотечный калькулятор</Link>
          </div>
        </section>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/listings" className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white">Найти жильё</Link>
          <Link href="/register?next=%2Flistings%2Fnew" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black">Разместить объявление</Link>
          <Link href="/uz" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold">O‘zbekcha</Link>
        </div>
      </div>
    </main>
  )
}
