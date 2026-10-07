import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getListingCardImageUrl } from '@/lib/listing-image'

const SITE_URL = 'https://royalhouse.uz'
const PAGE_SIZE = 12

type Config = {
  district: string
  districtSlug: string
  category: string
  title: string
  description: string
  h1: string
  propertyType: 'apartment' | 'house'
  listingType: 'sale' | 'rent'
}

const PAGES: Config[] = [
  ['yunusobod','kvartira-sotiladi','Yunusobod','Yunusobodda kvartira sotiladi — Royalhouse','Yunusobod, Toshkentdagi sotiladigan kvartiralarni toping. Narx, maydon va xona soni bo‘yicha e’lonlarni ko‘ring.','Yunusobodda kvartira sotiladi','apartment','sale'],
  ['chilonzor','kvartira-sotiladi','Chilonzor','Chilonzorda kvartira sotiladi — Royalhouse','Chilonzor, Toshkentdagi sotiladigan kvartiralarni toping. Mavjud e’lonlarni narx va maydon bo‘yicha solishtiring.','Chilonzorda kvartira sotiladi','apartment','sale'],
  ['mirobod','kvartira-sotiladi','Mirobod','Mirobodda kvartira sotiladi — Royalhouse','Mirobod, Toshkentdagi sotiladigan kvartiralarni toping. Narx, maydon va xona soni bo‘yicha e’lonlarni ko‘ring.','Mirobodda kvartira sotiladi','apartment','sale'],
  ['yakkasaroy','kvartira-sotiladi','Yakkasaroy','Yakkasaroyda kvartira sotiladi — Royalhouse','Yakkasaroy, Toshkentdagi sotiladigan kvartiralarni toping. Joylashuv, narx va maydonni solishtiring.','Yakkasaroyda kvartira sotiladi','apartment','sale'],
  ['mirzo-ulugbek','kvartira-sotiladi','Mirzo Ulug‘bek','Mirzo Ulug‘bekda kvartira sotiladi — Royalhouse','Mirzo Ulug‘bek, Toshkentdagi sotiladigan kvartiralarni toping. Mavjud e’lonlarni ko‘rib chiqing.','Mirzo Ulug‘bekda kvartira sotiladi','apartment','sale'],
  ['sergeli','kvartira-sotiladi','Sergeli','Sergelida kvartira sotiladi — Royalhouse','Sergeli, Toshkentdagi sotiladigan kvartiralarni toping. Narx va xona soni bo‘yicha mos variantlarni solishtiring.','Sergelida kvartira sotiladi','apartment','sale'],
  ['bektemir','kvartira-sotiladi','Bektemir','Bektemirda kvartira sotiladi — Royalhouse','Bektemir, Toshkentdagi sotiladigan kvartiralarni toping. Mavjud e’lonlarni narx va maydon bo‘yicha solishtiring.','Bektemirda kvartira sotiladi','apartment','sale'],
  ['uchtepa','kvartira-sotiladi','Uchtepa','Uchtepada kvartira sotiladi — Royalhouse','Uchtepa, Toshkentdagi sotiladigan kvartiralarni toping. Narx, maydon va xona soni bo‘yicha e’lonlarni ko‘ring.','Uchtepada kvartira sotiladi','apartment','sale'],
  ['olmazor','kvartira-sotiladi','Olmazor','Olmazorda kvartira sotiladi — Royalhouse','Olmazor, Toshkentdagi sotiladigan kvartiralarni toping. Mavjud variantlarni narx va maydon bo‘yicha solishtiring.','Olmazorda kvartira sotiladi','apartment','sale'],
  ['shayxontohur','kvartira-sotiladi','Shayxontohur','Shayxontohurda kvartira sotiladi — Royalhouse','Shayxontohur, Toshkentdagi sotiladigan kvartiralarni toping. Narx, maydon va xona soni bo‘yicha e’lonlarni ko‘ring.','Shayxontohurda kvartira sotiladi','apartment','sale'],
  ['yashnobod','kvartira-sotiladi','Yashnobod','Yashnobodda kvartira sotiladi — Royalhouse','Yashnobod, Toshkentdagi sotiladigan kvartiralarni toping. Mavjud e’lonlarni narx va maydon bo‘yicha solishtiring.','Yashnobodda kvartira sotiladi','apartment','sale'],
  ['yangihayot','kvartira-sotiladi','Yangihayot','Yangihayotda kvartira sotiladi — Royalhouse','Yangihayot, Toshkentdagi sotiladigan kvartiralarni toping. Narx va xona soni bo‘yicha mos variantlarni solishtiring.','Yangihayotda kvartira sotiladi','apartment','sale'],
].map(([districtSlug, category, district, title, description, h1, propertyType, listingType]) => ({ districtSlug, category, district, title, description, h1, propertyType, listingType } as Config))

function getConfig(district: string, category: string) {
  return PAGES.find((page) => page.districtSlug === district && page.category === category)
}

export function generateStaticParams() {
  return PAGES.map(({ districtSlug, category }) => ({ district: districtSlug, category }))
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ district: string; category: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { district, category } = await params
  const page = getConfig(district, category)
  if (!page) return {}
  const paramsObject = (await searchParams) || {}
  const hasQueryParams = Object.keys(paramsObject).length > 0
  const url = `${SITE_URL}/toshkent/${page.districtSlug}/${page.category}`
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, siteName: 'Royalhouse', title: page.title, description: page.description, locale: 'uz_UZ' },
  }
}

export default async function DistrictSeoPage({ params }: { params: Promise<{ district: string; category: string }> }) {
  const { district, category } = await params
  const page = getConfig(district, category)
  if (!page) notFound()

  const supabase = await createClient()
  const { data, count, error } = await supabase
    .from('listing_search')
    .select('id,title,title_ru,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,seller_name,effective_promotion_badge,published_at', { count: 'exact' })
    .eq('status', 'active')
    .or('city.eq.Toshkent,city.eq.Toshkent shahri,city.eq.Toshkent shahar')
    .eq('district', page.district)
    .eq('listing_type', page.listingType)
    .eq('property_type', page.propertyType)
    .order('effective_promotion_rank', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (error) throw error
  if (!count) notFound()

  const ids = (data || []).map((item) => item.id)
  const { data: images } = ids.length
    ? await supabase.from('listing_images').select('listing_id,image_url,sort_order').in('listing_id', ids).eq('sort_order', 0)
    : { data: [] as { listing_id: string; image_url: string; sort_order: number | null }[] }
  const imageMap = new Map((images || []).map((image) => [image.listing_id, getListingCardImageUrl(image.image_url)]))
  const url = `${SITE_URL}/toshkent/${page.districtSlug}/${page.category}`
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Royalhouse', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Toshkent', item: `${SITE_URL}/toshkent` },
      { '@type': 'ListItem', position: 3, name: page.district, item: `${SITE_URL}/toshkent/${page.districtSlug}/kvartira-sotiladi` },
      { '@type': 'ListItem', position: 4, name: page.h1, item: url },
    ],
  }
  const jsonLd = JSON.stringify(breadcrumbData).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:py-14">
        <nav className="mb-6 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-emerald-700">Royalhouse</Link><span className="mx-2">/</span>
          <Link href="/toshkent" className="hover:text-emerald-700">Toshkent</Link><span className="mx-2">/</span>
          <span className="text-slate-700">{page.h1}</span>
        </nav>
        <header className="max-w-4xl">
          <p className="text-xs font-black tracking-[.18em] text-emerald-700">ROYALHOUSE · {page.district.toUpperCase()}</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">{page.h1}</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">{page.description}</p>
        </header>
        <section className="mt-9">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div><h2 className="text-2xl font-black">{page.h1}</h2><p className="mt-1 text-sm text-slate-500">{count} ta faol e’lon</p></div>
            <Link href={`/toshkent/${page.category}`} className="font-bold text-emerald-700">Toshkent bo‘yicha →</Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(data || []).map((item) => (
              <Link key={item.id} href={`/listings/${item.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="relative aspect-[4/3] bg-slate-100">
                  {imageMap.get(item.id) ? <img src={imageMap.get(item.id)} alt={item.title} className="h-full w-full object-cover" /> : null}
                  {item.effective_promotion_badge ? <span className="absolute left-3 top-3 rounded-lg bg-amber-400 px-2 py-1 text-xs font-black text-slate-950">{item.effective_promotion_badge.toUpperCase()}</span> : null}
                </div>
                <div className="p-4">
                  <div className="text-lg font-black">{new Intl.NumberFormat('uz-UZ').format(Number(item.price))} {item.currency === 'USD' ? '$' : 'so‘m'}</div>
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
          <h2 className="text-2xl font-black">{page.district} tumanida ko‘chmas mulk</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Royalhouse’da {page.district} tumanidagi ko‘chmas mulk e’lonlarini ko‘ring. E’lonni ochib, batafsil ma’lumot va sotuvchi yoki rieltor bilan bog‘lanish imkoniyatlarini ko‘rib chiqing.</p>
        </section>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </main>
  )
}
