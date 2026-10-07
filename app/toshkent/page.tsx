import type { Metadata } from 'next'
import Link from 'next/link'

const SITE_URL = 'https://royalhouse.uz'

const categories = [
  ['kvartira-sotiladi', 'Kvartira sotiladi'],
  ['uy-sotiladi', 'Uy sotiladi'],
  ['kvartira-ijara', 'Kvartira ijaraga'],
  ['uy-ijara', 'Uy ijaraga'],
  ['novostroyka', 'Yangi uylar va novostroyka'],
  ['yer-sotiladi', 'Yer sotiladi'],
  ['tijorat', 'Tijorat ko‘chmas mulki'],
]

export async function generateMetadata({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = (await searchParams) || {}
  const hasQueryParams = Object.keys(params).length > 0
  return {
    title: 'Toshkentda ko‘chmas mulk — Royalhouse',
    description: 'Toshkentda kvartira, uy, hovli, yer va tijorat ko‘chmas mulkini sotib olish yoki ijaraga olish uchun e’lonlarni toping.',
    alternates: { canonical: `${SITE_URL}/toshkent` },
    robots: { index: !hasQueryParams, follow: true },
  }
}

export default function TashkentHub() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <nav className="text-xs font-semibold text-slate-500"><Link href="/" className="hover:text-emerald-700">Royalhouse</Link><span className="mx-2">/</span><span className="text-slate-700">Toshkent</span></nav>
        <header className="mt-6 max-w-4xl">
          <p className="text-xs font-black tracking-[.18em] text-emerald-700">ROYALHOUSE · TOSHKENT</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Toshkentda ko‘chmas mulk</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">Toshkentda sotiladigan va ijaraga beriladigan kvartira, uy, hovli, yer uchastkasi, yangi qurilish va tijorat obyektlarini Royalhouse orqali toping.</p>
        </header>
        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map(([slug, label]) => (
            <Link key={slug} href={`/toshkent/${slug}`} className="rounded-2xl border border-slate-200 bg-white p-5 font-black shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
              {label}<span className="mt-2 block text-sm font-semibold text-emerald-700">E’lonlarni ko‘rish →</span>
            </Link>
          ))}
        </section>
        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-black">Toshkent ko‘chmas mulk bozori</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">Royalhouse Toshkent bo‘yicha ko‘chmas mulk e’lonlarini bir joyda jamlaydi. Xaridorlar uy va kvartiralarni, ijarachilar esa ijara variantlarini topishi mumkin. Yangi qurilishlar va ipoteka xizmatlari uchun ham alohida sahifalar mavjud.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
            <Link href="/listings" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Barcha e’lonlar</Link>
            <Link href="/ipoteka/kalkulyator" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Ipoteka kalkulyatori</Link>
            <Link href="/realtors" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Rieltorlar</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
