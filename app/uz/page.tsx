import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'RoyalHouse — O‘zbekistonda ko‘chmas mulk',
  description: 'O‘zbekistonda uy, kvartira, hovli va boshqa ko‘chmas mulkni topish, sotish va ijaraga olish platformasi.',
  alternates: { canonical: 'https://royalhouse.uz/uz', languages: { uz: 'https://royalhouse.uz/uz', ru: 'https://royalhouse.uz/ru', 'x-default': 'https://royalhouse.uz/' } },
  openGraph: { locale: 'uz_UZ', url: 'https://royalhouse.uz/uz', siteName: 'RoyalHouse', title: 'RoyalHouse — O‘zbekistonda ko‘chmas mulk', description: 'Uy toping, e’lon joylashtiring va ko‘chmas mulk imkoniyatlarini RoyalHouse’da ko‘ring.' },
}

export default function UzLanding() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-sm font-black tracking-widest text-emerald-600">ROYALHOUSE</p>
        <h1 className="mt-3 text-4xl font-black sm:text-6xl">O‘zbekistonda ko‘chmas mulk</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">Uy, kvartira, hovli va boshqa ko‘chmas mulkni toping, ijaraga oling yoki e’lon joylashtiring.</p>
        <section className="mt-10 max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black">Toshkentda ko‘chmas mulk toping</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Royalhouse’da Toshkent va O‘zbekiston bo‘ylab kvartira, uy, hovli, yer uchastkasi va boshqa ko‘chmas mulk e’lonlarini ko‘rishingiz mumkin.
            Sotib olish, ijara, yangi qurilish va ipoteka bo‘yicha kerakli ma’lumotlarni bir joydan toping.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
            <Link href="/listings?tab=sale" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Kvartira va uylar</Link>
            <Link href="/listings?tab=rent" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Ijara</Link>
            <Link href="/listings?tab=sale&type=new_building" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Yangi qurilish</Link>
            <Link href="/ipoteka/kalkulyator" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Ipoteka kalkulyatori</Link>
          </div>
        </section>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/listings" className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white">Uy topish</Link>
          <Link href="/register?next=%2Flistings%2Fnew" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black">E’lon joylashtirish</Link>
          <Link href="/ru" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold">Русский</Link>
        </div>
      </div>
    </main>
  )
}
