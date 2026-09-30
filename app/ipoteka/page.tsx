import type { Metadata } from 'next'
import Link from 'next/link'
import { getMortgagePrograms } from '@/lib/mortgage-programs'

export const metadata: Metadata = {
  title: 'Ipoteka kreditlari O‘zbekistonda | Royalhouse',
  description: 'Royalhouse’da O‘zbekistondagi ipoteka dasturlarini solishtiring, mos uylarni toping va ipoteka imkoniyatingizni hisoblang.',
  alternates: { canonical: '/ipoteka' },
  openGraph: {
    title: 'Ipoteka kreditlari | Royalhouse',
    description: 'Birlamchi va ikkilamchi bozor uchun ipoteka dasturlari va kalkulyator.',
    type: 'website',
  },
}

export default function IpotekaPage() {
  const secondary = getMortgagePrograms('secondary')
  const primary = getMortgagePrograms('primary')

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Royalhouse — bosh sahifa">
            <img src="/royalhouse-icon.svg" alt="Royalhouse" className="h-10 w-10 rounded-xl object-cover" />
            <span className="text-2xl font-black tracking-tight text-slate-900">
              Royal<span className="text-emerald-500">house</span>
            </span>
          </Link>
        </div>
      </header>

      <section className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
          <p className="text-sm font-black uppercase tracking-[.2em] text-emerald-100">ROYALHOUSE</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Ипотечные кредиты</h1>
          <p className="mt-4 max-w-2xl text-base text-emerald-50 sm:text-lg">
            Amaldagi bank dasturlarini ko‘ring, shartlarini solishtiring va mos obyektni ipoteka kalkulyatori bilan hisoblang.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/ipoteka/vtorichnyy-rynok" className="rounded-2xl bg-white px-5 py-3 font-black text-emerald-700">
              Ипотека на вторичном рынке
            </Link>
            <Link href="/ipoteka/novostroyka" className="rounded-2xl border border-white/40 px-5 py-3 font-black text-white">
              Ипотека на новостройку
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-5 md:grid-cols-2">
          <Link href="/ipoteka/vtorichnyy-rynok" className="group rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg">
            <div className="text-3xl">🏠</div>
            <h2 className="mt-5 text-2xl font-black">Ипотека на вторичном рынке</h2>
            <p className="mt-2 text-slate-500">{secondary.length} ta bank dasturi · tayyor uy-joylar · ipotekaga mos obyektlar xaritasi</p>
            <span className="mt-6 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white">Ko‘rish</span>
          </Link>

          <Link href="/ipoteka/novostroyka" className="group rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg">
            <div className="text-3xl">🏗️</div>
            <h2 className="mt-5 text-2xl font-black">Ипотека на новостройку</h2>
            <p className="mt-2 text-slate-500">{primary.length} ta bank dasturi · yangi qurilish · mos obyektlar xaritasi</p>
            <span className="mt-6 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white">Ko‘rish</span>
          </Link>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">ROYALHOUSE SMART HOME TOOLS</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Uy tanlashni osonlashtiradigan 6 ta funksiya</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Avval imkoniyatingizni hisoblang, keyin mos uylarni toping, saqlang, kuzating va solishtiring.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/ipoteka/uy-qancha" className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">💰</span><h3 className="mt-3 font-black">1. Siz qancha uy olishingiz mumkin?</h3>
            <p className="mt-1 text-xs leading-5 text-slate-300">Daromad va badal asosida taxminiy uy budjetini hisoblang.</p>
            <span className="mt-3 inline-flex text-sm font-black text-emerald-300">Hisoblash →</span>
          </Link>

          <Link href="/ipoteka/imkoniyatlari" className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">💳</span><h3 className="mt-3 font-black">2. Ipoteka imkoniyatim</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Banklar, stavkalar, badal va taxminiy to‘lovlarni ko‘ring.</p>
            <span className="mt-3 inline-flex text-sm font-black text-emerald-700">Tekshirish →</span>
          </Link>

          <Link href="/listings?tab=sale&mortgage=true" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">🗺️</span><h3 className="mt-3 font-black">3. Menga mos uylar</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Ipotekaga mumkin bo‘lgan obyektlarni xaritada va ro‘yxatda toping.</p>
            <span className="mt-3 inline-flex text-sm font-black text-emerald-700">Uylarni ko‘rish →</span>
          </Link>

          <Link href="/account/favorites" className="rounded-2xl border border-rose-100 bg-rose-50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">❤️</span><h3 className="mt-3 font-black">4. Saqlangan uylar</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Yoqtirgan uylaringizni narxi va holati bilan saqlang.</p>
            <span className="mt-3 inline-flex text-sm font-black text-rose-700">Mening uylarim →</span>
          </Link>

          <Link href="/account/saved-searches" className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">🔔</span><h3 className="mt-3 font-black">5. Narx va yangi uy xabarnomasi</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Saqlangan qidiruv va uylar bo‘yicha xabarlarni yoqing.</p>
            <span className="mt-3 inline-flex text-sm font-black text-amber-700">Sozlash →</span>
          </Link>

          <Link href="/solishtirish" className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">⚖️</span><h3 className="mt-3 font-black">6. Uylarni solishtirish</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">3 tagacha uyni narx, maydon va ipoteka bo‘yicha taqqoslang.</p>
            <span className="mt-3 inline-flex text-sm font-black text-slate-700">Solishtirish →</span>
          </Link>
        </div>
      </section>
    </main>
  )
}
