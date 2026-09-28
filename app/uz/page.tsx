import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'RoyalHouse — O‘zbekistonda ko‘chmas mulk',
  description: 'O‘zbekistonda uy, kvartira, hovli va boshqa ko‘chmas mulkni topish, sotish va ijaraga olish platformasi.',
  alternates: { canonical: 'https://royalhouse.uz/uz', languages: { uz: 'https://royalhouse.uz/uz', ru: 'https://royalhouse.uz/ru', 'x-default': 'https://royalhouse.uz/uz' } },
  openGraph: { locale: 'uz_UZ', url: 'https://royalhouse.uz/uz', siteName: 'RoyalHouse', title: 'RoyalHouse — O‘zbekistonda ko‘chmas mulk', description: 'Uy toping, e’lon joylashtiring va ko‘chmas mulk imkoniyatlarini RoyalHouse’da ko‘ring.' },
}

export default function UzLanding() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-sm font-black tracking-widest text-emerald-600">ROYALHOUSE</p>
        <h1 className="mt-3 text-4xl font-black sm:text-6xl">O‘zbekistonda ko‘chmas mulk</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">Uy, kvartira, hovli va boshqa ko‘chmas mulkni toping, ijaraga oling yoki e’lon joylashtiring.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/listings" className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white">Uy topish</Link>
          <Link href="/register?next=%2Flistings%2Fnew" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black">E’lon joylashtirish</Link>
          <Link href="/ru" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold">Русский</Link>
        </div>
      </div>
    </main>
  )
}
