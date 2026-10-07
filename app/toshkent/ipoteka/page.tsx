import type { Metadata } from 'next'
import Link from 'next/link'

const SITE_URL = 'https://royalhouse.uz'

export const metadata: Metadata = {
  title: 'Toshkentda ipoteka — uy olish va ipoteka kalkulyatori | Royalhouse',
  description: 'Toshkentda ipoteka orqali uy olish imkoniyatlarini o‘rganing. Yangi qurilish, ikkilamchi bozor va ipoteka kalkulyatori sahifalariga o‘ting.',
  alternates: { canonical: `${SITE_URL}/toshkent/ipoteka` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/toshkent/ipoteka`,
    siteName: 'Royalhouse',
    title: 'Toshkentda ipoteka — Royalhouse',
    description: 'Toshkentda uy-joy xaridi uchun ipoteka yo‘nalishlarini va kalkulyatorni ko‘ring.',
    locale: 'uz_UZ',
  },
}

export default function TashkentMortgagePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <nav className="text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-emerald-700">Royalhouse</Link><span className="mx-2">/</span>
          <Link href="/toshkent" className="hover:text-emerald-700">Toshkent</Link><span className="mx-2">/</span>
          <span className="text-slate-700">Ipoteka</span>
        </nav>
        <header className="mt-6 max-w-4xl">
          <p className="text-xs font-black tracking-[.18em] text-emerald-700">ROYALHOUSE · TOSHKENT</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Toshkentda ipoteka orqali uy olish</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">Toshkentda uy yoki kvartira sotib olishni rejalashtirayotgan bo‘lsangiz, boshlang‘ich badal, kredit muddati, foiz stavkasi va oylik to‘lovni oldindan hisoblash foydali. Royalhouse ipoteka vositalari orqali xarid budjetini baholash va mos ko‘chmas mulkni izlash imkonini beradi.</p>
        </header>

        <section className="mt-9 grid gap-5 md:grid-cols-3">
          <Link href="/ipoteka/kalkulyator" className="rounded-3xl bg-emerald-700 p-6 text-white shadow-sm">
            <h2 className="text-xl font-black">Ipoteka kalkulyatori</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50">Uy narxi, boshlang‘ich badal, foiz va muddat asosida oylik to‘lovni hisoblang.</p>
            <span className="mt-5 inline-flex rounded-xl bg-white px-4 py-2 font-bold text-emerald-700">Hisoblash →</span>
          </Link>
          <Link href="/ipoteka/vtorichnyy-rynok" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Ikkilamchi bozor</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Tayyor uy-joylar uchun ipoteka dasturlari va mos obyektlarni ko‘ring.</p>
            <span className="mt-5 inline-flex font-bold text-emerald-700">Ko‘rish →</span>
          </Link>
          <Link href="/ipoteka/novostroyka" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Yangi qurilish</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Novostroyka uchun ipoteka dasturlari va mos variantlarni ko‘rib chiqing.</p>
            <span className="mt-5 inline-flex font-bold text-emerald-700">Ko‘rish →</span>
          </Link>
        </section>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-black">Toshkentda ipoteka bilan uy tanlash</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">Avval xarid budjetingizni aniqlang, keyin kvartira yoki uy narxini, boshlang‘ich badalni va oylik to‘lovni solishtiring. Yangi qurilish va ikkilamchi bozordagi shartlar bir-biridan farq qilishi mumkin. Royalhouse’da ipoteka kalkulyatori, mos obyektlar va bank dasturlari bir-biriga bog‘langan.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
            <Link href="/toshkent/kvartira-sotiladi" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Toshkentda kvartira sotiladi</Link>
            <Link href="/toshkent/novostroyka" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Toshkentda yangi uylar</Link>
            <Link href="/toshkent/uy-narxlari" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Toshkentda uy narxlari</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
