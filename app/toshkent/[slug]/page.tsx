import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getListingCardImageUrl } from '@/lib/listing-image'

const SITE_URL = 'https://royalhouse.uz'
const PAGE_SIZE = 12

type LandingConfig = {
  slug: string
  title: string
  description: string
  h1: string
  intro: string
  listingType: 'sale' | 'rent'
  propertyType: 'apartment' | 'house' | 'land' | 'commercial' | 'new_building'
}

const PAGES: LandingConfig[] = [
  {
    slug: 'kvartira-sotiladi',
    title: 'Toshkentda kvartira sotiladi — Royalhouse',
    description: 'Toshkentda sotiladigan kvartiralarni toping: narx, maydon, xona soni va tuman bo‘yicha e’lonlarni ko‘ring.',
    h1: 'Toshkentda kvartira sotiladi',
    intro: 'Toshkent shahrida sotiladigan kvartiralarni Royalhouse orqali toping. E’lonlarni narx, maydon, xona soni va tuman bo‘yicha ko‘rib chiqing.',
    listingType: 'sale',
    propertyType: 'apartment',
  },
  {
    slug: 'uy-sotiladi',
    title: 'Toshkentda uy sotiladi — Royalhouse',
    description: 'Toshkentda sotiladigan xususiy uy va hovlilarni toping. Narx, maydon va tuman bo‘yicha e’lonlarni ko‘ring.',
    h1: 'Toshkentda uy sotiladi',
    intro: 'Toshkentdagi sotuvdagi xususiy uy va hovlilarni bir joyda ko‘ring. Royalhouse’da yangi e’lonlarni solishtirish va sotuvchi bilan bog‘lanish mumkin.',
    listingType: 'sale',
    propertyType: 'house',
  },
  {
    slug: 'hovli-sotiladi',
    title: 'Toshkentda hovli sotiladi — Royalhouse',
    description: 'Toshkentda hovli sotib olish uchun mavjud e’lonlarni ko‘ring. Narx, maydon va joylashuvni solishtiring.',
    h1: 'Toshkentda hovli sotiladi',
    intro: 'Toshkent shahrida sotiladigan hovlilarni Royalhouse katalogidan toping. Hudud, narx va uy maydonini solishtirib, mos e’lonni tanlang.',
    listingType: 'sale',
    propertyType: 'house',
  },
  {
    slug: 'kvartira-ijara',
    title: 'Toshkentda kvartira ijaraga — Royalhouse',
    description: 'Toshkentda ijaraga beriladigan kvartiralarni toping. Narx, tuman va xona soni bo‘yicha e’lonlarni ko‘ring.',
    h1: 'Toshkentda kvartira ijaraga',
    intro: 'Toshkentdagi ijara kvartiralarini Royalhouse orqali toping. Oylik narx, tuman, xona soni va maydon bo‘yicha e’lonlarni solishtiring.',
    listingType: 'rent',
    propertyType: 'apartment',
  },
  {
    slug: 'uy-ijara',
    title: 'Toshkentda uy ijaraga — Royalhouse',
    description: 'Toshkentda ijaraga beriladigan xususiy uy va hovlilarni toping. Joylashuv va narx bo‘yicha e’lonlarni ko‘ring.',
    h1: 'Toshkentda uy ijaraga',
    intro: 'Toshkentdagi ijara uy va hovlilarini Royalhouse katalogidan toping. Mavjud e’lonlarni joylashuv, maydon va narx bo‘yicha solishtiring.',
    listingType: 'rent',
    propertyType: 'house',
  },
  {
    slug: 'novostroyka',
    title: 'Toshkentda yangi uylar va novostroyka — Royalhouse',
    description: 'Toshkentdagi yangi qurilish va novostroykalardan kvartira toping. Narx, maydon va joylashuv bo‘yicha e’lonlarni ko‘ring.',
    h1: 'Toshkentda yangi uylar va novostroyka',
    intro: 'Toshkentdagi yangi qurilish loyihalari va novostroyka e’lonlarini Royalhouse’da ko‘ring. Yangi uylarni narx, maydon va joylashuv bo‘yicha solishtiring.',
    listingType: 'sale',
    propertyType: 'new_building',
  },
  {
    slug: 'yer-sotiladi',
    title: 'Toshkentda yer uchastkasi sotiladi — Royalhouse',
    description: 'Toshkentda sotiladigan yer uchastkalarini toping. Qurilish va investitsiya uchun mavjud e’lonlarni ko‘ring.',
    h1: 'Toshkentda yer sotiladi',
    intro: 'Toshkent shahrida sotiladigan yer uchastkalarini Royalhouse orqali toping. Maydon, narx va joylashuv bo‘yicha mos variantlarni solishtiring.',
    listingType: 'sale',
    propertyType: 'land',
  },
  {
    slug: 'tijorat',
    title: 'Toshkentda tijorat ko‘chmas mulki — Royalhouse',
    description: 'Toshkentdagi tijorat ko‘chmas mulk e’lonlarini toping: ofis, do‘kon va boshqa biznes obyektlari.',
    h1: 'Toshkentda tijorat ko‘chmas mulki',
    intro: 'Toshkentdagi tijorat ko‘chmas mulk e’lonlarini Royalhouse’da toping. Biznes uchun mos obyektlarni narx, maydon va joylashuv bo‘yicha ko‘rib chiqing.',
    listingType: 'sale',
    propertyType: 'commercial',
  },
]

function getConfig(slug: string) {
  return PAGES.find((page) => page.slug === slug)
}

export function generateStaticParams() {
  return PAGES.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = getConfig(slug)
  if (!page) return {}
  const url = `${SITE_URL}/toshkent/${page.slug}`
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: 'Royalhouse',
      title: page.title,
      description: page.description,
      locale: 'uz_UZ',
    },
  }
}

export default async function TashkentSeoLanding({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = getConfig(slug)
  if (!page) notFound()

  const supabase = await createClient()
  let query = supabase
    .from('listing_search')
    .select('id,title,title_ru,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,seller_name,effective_promotion_badge,published_at', { count: 'exact' })
    .eq('status', 'active')
    .eq('city', 'Toshkent')
    .eq('listing_type', page.listingType)
    .eq('property_type', page.propertyType)
    .order('effective_promotion_rank', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(PAGE_SIZE)

  const { data, count, error } = await query
  if (error) throw error
  if (!count) notFound()

  const ids = (data || []).map((item) => item.id)
  const { data: images } = ids.length
    ? await supabase.from('listing_images').select('listing_id,image_url,sort_order').in('listing_id', ids).eq('sort_order', 0)
    : { data: [] as { listing_id: string; image_url: string; sort_order: number | null }[] }

  const imageMap = new Map((images || []).map((image) => [image.listing_id, getListingCardImageUrl(image.image_url)]))
  const url = `${SITE_URL}/toshkent/${page.slug}`
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Royalhouse', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Toshkent', item: `${SITE_URL}/toshkent` },
      { '@type': 'ListItem', position: 3, name: page.h1, item: url },
    ],
  }
  const jsonLd = JSON.stringify(breadcrumbs).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:py-14">
        <nav className="mb-6 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-emerald-700">Royalhouse</Link>
          <span className="mx-2">/</span>
          <span>Toshkent</span>
          <span className="mx-2">/</span>
          <span className="text-slate-700">{page.h1}</span>
        </nav>
        <header className="max-w-4xl">
          <p className="text-xs font-black tracking-[.18em] text-emerald-700">ROYALHOUSE · TOSHKENT</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">{page.h1}</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">{page.intro}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
            <Link href="/listings?tab=sale&region=Toshkent%20shahri" className="rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200 hover:ring-emerald-300">Barcha sotuvlar</Link>
            <Link href="/listings?tab=rent&region=Toshkent%20shahri" className="rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200 hover:ring-emerald-300">Ijara</Link>
            <Link href="/ipoteka/kalkulyator" className="rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200 hover:ring-emerald-300">Ipoteka kalkulyatori</Link>
            <Link href="/realtors" className="rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200 hover:ring-emerald-300">Rieltorlar</Link>
          </div>
        </header>

        <section className="mt-9">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">{page.h1}</h2>
              <p className="mt-1 text-sm text-slate-500">{count} ta faol e’lon</p>
            </div>
            <Link href={`/listings?tab=${page.listingType}&type=${page.propertyType}&region=Toshkent%20shahri`} className="font-bold text-emerald-700">Barchasini ko‘rish →</Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(data || []).map((item) => (
              <Link key={item.id} href={`/listings/${item.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="relative aspect-[4/3] bg-slate-100">
                  {imageMap.get(item.id) ? <img src={imageMap.get(item.id)} alt={item.title} className="h-full w-full object-cover" /> : null}
                  {item.effective_promotion_badge ? <span className="absolute left-3 top-3 rounded-lg bg-amber-400 px-2 py-1 text-xs font-black text-slate-950">{item.effective_promotion_badge.toUpperCase()}</span> : null}
                </div>
                <div className="p-4">
                  <div className="text-lg font-black">{new Intl.NumberFormat('uz-UZ').format(Number(item.price))} {item.currency === 'USD' ? '$' : 'so‘m'}{item.listing_type === 'rent' ? ' / oy' : ''}</div>
                  <h3 className="mt-1 line-clamp-2 text-sm font-bold">{item.title}</h3>
                  <p className="mt-2 text-xs text-slate-500">{item.city}{item.district ? `, ${item.district}` : ''}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-500">
                    {item.area_m2 ? <span>{item.area_m2} m²</span> : null}
                    {item.rooms !== null ? <span>· {item.rooms} xona</span> : null}
                    {item.floor !== null ? <span>· {item.floor}{item.floors_total ? `/${item.floors_total}` : ''} qavat</span> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-black">Royalhouse’da Toshkent ko‘chmas mulki</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{page.intro} E’lonlarni ko‘rib chiqing, batafsil ma’lumotni oching va mos variant bo‘yicha sotuvchi yoki rieltor bilan bog‘laning.</p>
        </section>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </main>
  )
}
