import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

const SITE_URL = 'https://royalhouse.uz'

export const metadata: Metadata = {
  title: 'Toshkentda uy va kvartira narxlari — Royalhouse',
  description: 'Toshkentda uy va kvartira narxlarini faol e’lonlar asosida ko‘ring. Hudud, uy turi va sotuv yoki ijara bo‘yicha variantlarni solishtiring.',
  alternates: { canonical: `${SITE_URL}/toshkent/uy-narxlari` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/toshkent/uy-narxlari`,
    siteName: 'Royalhouse',
    title: 'Toshkentda uy va kvartira narxlari — Royalhouse',
    description: 'Toshkentdagi faol ko‘chmas mulk e’lonlari asosida uy va kvartira narxlarini solishtiring.',
    locale: 'uz_UZ',
  },
}

function money(value: number, currency: string | null) {
  return `${new Intl.NumberFormat('uz-UZ').format(Math.round(value))} ${currency === 'USD' ? '$' : 'so‘m'}`
}

export default async function TashkentPricesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listing_search')
    .select('listing_type,property_type,price,currency')
    .eq('status', 'active')
    .or('city.eq.Toshkent,city.eq.Toshkent shahri,city.eq.Toshkent shahar')
    .in('listing_type', ['sale', 'rent'])
    .in('property_type', ['apartment', 'house', 'new_building'])

  if (error) throw error

  const rows = data || []
  const sale = rows.filter((x) => x.listing_type === 'sale')
  const rent = rows.filter((x) => x.listing_type === 'rent')
  const apartments = sale.filter((x) => x.property_type === 'apartment')
  const houses = sale.filter((x) => x.property_type === 'house')
  const newBuildings = sale.filter((x) => x.property_type === 'new_building')

  const stats = [
    ['Kvartira sotiladi', apartments],
    ['Uy sotiladi', houses],
    ['Novostroyka', newBuildings],
    ['Kvartira va uy ijarasi', rent],
  ].map(([label, items]) => {
    const list = items as typeof rows
    const values = list.map((x) => Number(x.price)).filter((x) => Number.isFinite(x) && x > 0)
    const currency = list[0]?.currency || 'UZS'
    return { label: label as string, count: list.length, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, currency }
  })

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <nav className="text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-emerald-700">Royalhouse</Link><span className="mx-2">/</span>
          <Link href="/toshkent" className="hover:text-emerald-700">Toshkent</Link><span className="mx-2">/</span>
          <span className="text-slate-700">Uy va kvartira narxlari</span>
        </nav>
        <header className="mt-6 max-w-4xl">
          <p className="text-xs font-black tracking-[.18em] text-emerald-700">ROYALHOUSE · TOSHKENT</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Toshkentda uy va kvartira narxlari</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">Toshkentdagi faol e’lonlar asosida uy-joy narxlarini yo‘nalishlar bo‘yicha solishtiring. Narxlar e’lonlarda ko‘rsatilgan qiymatlardan olinadi va bozorning to‘liq o‘rtacha narxini anglatmaydi.</p>
        </header>

        <section className="mt-9 grid gap-4 sm:grid-cols-2">
          {stats.map((item) => (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-black">{item.label}</h2>
              <p className="mt-1 text-xs text-slate-500">{item.count} ta faol e’lon</p>
              {item.min !== null ? (
                <div className="mt-4 text-sm">
                  <span className="font-bold">Ko‘rsatilgan narx oralig‘i:</span>{' '}
                  <span>{money(item.min, item.currency)} — {money(item.max!, item.currency)}</span>
                </div>
              ) : <p className="mt-4 text-sm text-slate-500">Hozircha bu yo‘nalishda faol e’lon yo‘q.</p>}
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-black">Toshkentda uy narxini qanday solishtirish mumkin?</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">Kvartira yoki uy narxini baholashda faqat umumiy summaga emas, balki tuman, maydon, xona soni, uy holati va yangi yoki ikkilamchi bozor ekaniga ham qarang. Bir xil narxdagi obyektlarning qiymati joylashuv va maydon sabab sezilarli farq qilishi mumkin.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
            <Link href="/toshkent/kvartira-sotiladi" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Toshkentda kvartira sotiladi</Link>
            <Link href="/toshkent/uy-sotiladi" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Toshkentda uy sotiladi</Link>
            <Link href="/toshkent/novostroyka" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Toshkent novostroyka</Link>
            <Link href="/ipoteka/kalkulyator" className="rounded-xl bg-emerald-50 px-4 py-2 text-emerald-700">Ipoteka kalkulyatori</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
