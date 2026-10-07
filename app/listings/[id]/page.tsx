import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ListingDetailClient from './ListingDetailClient'
import { createClient } from '@/utils/supabase/server'
import { getListingCardImageUrl } from '@/lib/listing-image'

const SITE_URL = 'https://royalhouse.uz'

type ListingImage = { image_url: string; sort_order: number | null }
type Listing = {
  id: string; owner_id: string; title: string; title_ru?: string | null; description?: string | null
  listing_type: string; property_type: string; price: number; currency: string
  area_m2: number | null; rooms: number | null; floor: number | null; floors_total: number | null
  district: string | null; city: string; address?: string | null; latitude?: number | null; longitude?: number | null
  seller_type: string; seller_name: string | null; seller_phone?: string | null; taxonomy_code?: string | null
  is_mortgage_available: boolean; is_verified: boolean; is_trusted_seller: boolean; is_featured: boolean
  promotion_rank?: number | null; promotion_badge?: string | null; promoted_until?: string | null; bumped_at?: string | null
  published_at: string | null; draft_data?: Record<string, any> | null; listing_images?: ListingImage[]
}

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

async function getListing(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select('id,owner_id,title,title_ru,description,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,address,latitude,longitude,taxonomy_code,seller_type,seller_name,seller_phone,is_mortgage_available,is_verified,is_trusted_seller,is_featured,promotion_rank,promotion_badge,promoted_until,bumped_at,published_at,draft_data,listing_images(image_url,sort_order)')
    .eq('id', id).eq('status', 'active').maybeSingle()

  if (error || !data) return null

  const now = new Date()
  const nowIso = now.toISOString()
  const { data: promotionRows } = await supabase
    .from('listing_promotions')
    .select('product_code,starts_at,ends_at,status')
    .eq('listing_id', id)
    .eq('status', 'active')
    .lte('starts_at', nowIso)
    .not('ends_at', 'is', null)
    .gt('ends_at', nowIso)

  const productCodes = Array.from(new Set((promotionRows || []).map((row: any) => row.product_code).filter(Boolean)))
  const { data: promotionProducts } = productCodes.length
    ? await supabase.from('monetization_products').select('code,boost_rank,badge').in('code', productCodes)
    : { data: [] as any[] }

  const productByCode = new Map((promotionProducts || []).map((product: any) => [product.code, product]))
  const activePromotions = (promotionRows || [])
    .map((row: any) => ({ ...row, product: productByCode.get(row.product_code) }))
    .filter((row: any) => row.product)
    .sort((a: any, b: any) => Number(b.product.boost_rank || 0) - Number(a.product.boost_rank || 0))

  const topPromotion = activePromotions[0]
  const bumpActive = !!data.bumped_at && new Date(data.bumped_at).getTime() > now.getTime() - 24 * 60 * 60 * 1000
  const fallbackPromotionActive = !topPromotion && data.promoted_until && new Date(data.promoted_until).getTime() > now.getTime()
  const effectiveBadge = topPromotion?.product?.badge || (bumpActive ? 'UP' : fallbackPromotionActive ? data.promotion_badge : null)
  const effectiveUntil = topPromotion?.ends_at || (bumpActive ? new Date(new Date(data.bumped_at).getTime() + 24 * 60 * 60 * 1000).toISOString() : fallbackPromotionActive ? data.promoted_until : null)
  const effectiveRank = Math.max(
    Number(topPromotion?.product?.boost_rank || 0),
    bumpActive ? 20 : 0,
    fallbackPromotionActive ? Number(data.promotion_rank || 0) : 0,
  )

  return {
    ...(data as Listing),
    promotion_badge: effectiveBadge,
    promoted_until: effectiveUntil,
    is_featured: effectiveRank >= 60,
  }
}

function formatPrice(listing: Listing) {
  const price = new Intl.NumberFormat('uz-UZ').format(Number(listing.price))
  return listing.currency === 'USD' ? `$${price}` : `${price} so‘m`
}

function buildDescription(listing: Listing) {
  const location = [listing.district, listing.city].filter(Boolean).join(', ')
  const details = [
    formatPrice(listing),
    location,
    listing.area_m2 ? `${listing.area_m2} m²` : null,
    listing.rooms ? `${listing.rooms} xona` : null,
  ].filter(Boolean).join(' · ')
  const base = listing.description || `${listing.title} — RoyalHouse ko‘chmas mulk e’loni.`
  return `${base.replace(/\s+/g, ' ').trim()} ${details}`.trim().slice(0, 160)
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const listing = await getListing(id)

  if (!listing) {
    return {
      title: 'E’lon topilmadi — Royalhouse',
      robots: { index: false, follow: true },
    }
  }

  const url = `${SITE_URL}/listings/${encodeURIComponent(listing.id)}`
  const location = [listing.district, listing.city].filter(Boolean).join(', ')
  const title = `${listing.title} — ${formatPrice(listing)} | Royalhouse`
  const description = buildDescription(listing)
  const firstImage = listing.listing_images?.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.image_url
  const imageUrl = firstImage
    ? (getListingCardImageUrl(firstImage).startsWith('http') ? getListingCardImageUrl(firstImage) : `${SITE_URL}${getListingCardImageUrl(firstImage)}`)
    : `${SITE_URL}/royalhouse-icon.svg`

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      url,
      siteName: 'Royalhouse',
      locale: 'uz_UZ',
      title,
      description,
      images: [{ url: imageUrl, alt: listing.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    ...(location ? { keywords: [listing.title, location, 'ko‘chmas mulk', 'uy sotiladi', 'kvartira sotiladi'] } : {}),
  }
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await getListing(id)
  if (!listing) notFound()

  const images = (listing.listing_images || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((image) => ({ ...image, image_url: getListingCardImageUrl(image.image_url) }))

  const url = `${SITE_URL}/listings/${encodeURIComponent(listing.id)}`
  const title = listing.title
  const description = (listing.description || `${listing.title} — RoyalHouse ko‘chmas mulk e’loni.`).replace(/\s+/g, ' ').trim().slice(0, 500)
  const location = [listing.address, listing.district, listing.city].filter(Boolean).join(', ')
  const isRental = listing.listing_type === 'daily' || listing.listing_type === 'rent' || listing.taxonomy_code === 'rent_dacha'

  const structuredData = {
    '@context': 'https://schema.org', '@type': 'RealEstateListing', name: title, description, url,
    image: images.map((image) => image.image_url.startsWith('http') ? image.image_url : `${SITE_URL}${image.image_url}`), datePosted: listing.published_at || undefined,
    ...(location ? { address: { '@type': 'PostalAddress', streetAddress: listing.address || undefined, addressLocality: listing.district || listing.city, addressRegion: listing.city, addressCountry: 'UZ' } } : {}),
    ...(listing.latitude != null && listing.longitude != null ? { geo: { '@type': 'GeoCoordinates', latitude: listing.latitude, longitude: listing.longitude } } : {}),
    offers: { '@type': 'Offer', price: Number(listing.price), priceCurrency: listing.currency === 'USD' ? 'USD' : 'UZS', url, availability: 'https://schema.org/InStock', ...(isRental ? { category: 'Rental' } : {}) },
    ...(listing.seller_name ? { seller: { '@type': 'Person', name: listing.seller_name } } : {}),
  }

  const category = (() => {
    if (listing.listing_type === 'rent' && listing.property_type === 'apartment') return { slug: 'kvartira-ijara', name: 'Toshkentda kvartira ijaraga' }
    if (listing.listing_type === 'rent' && listing.property_type === 'house') return { slug: 'uy-ijara', name: 'Toshkentda uy ijaraga' }
    if (listing.listing_type === 'sale' && listing.property_type === 'apartment') return { slug: 'kvartira-sotiladi', name: 'Toshkentda kvartira sotiladi' }
    if (listing.listing_type === 'sale' && listing.property_type === 'house') return { slug: 'uy-sotiladi', name: 'Toshkentda uy sotiladi' }
    if (listing.listing_type === 'sale' && listing.property_type === 'new_building') return { slug: 'novostroyka', name: 'Toshkentda yangi uylar va novostroyka' }
    if (listing.listing_type === 'sale' && listing.property_type === 'land') return { slug: 'yer-sotiladi', name: 'Toshkentda yer sotiladi' }
    if (listing.listing_type === 'sale' && listing.property_type === 'commercial') return { slug: 'tijorat', name: 'Toshkentda tijorat ko‘chmas mulki' }
    return null
  })()
  const districtSlugs: Record<string, string> = {
    Yunusobod: 'yunusobod',
    Chilonzor: 'chilonzor',
    Mirobod: 'mirobod',
    Yakkasaroy: 'yakkasaroy',
    'Mirzo Ulug‘bek': 'mirzo-ulugbek',
    'Mirzo Ulugbek': 'mirzo-ulugbek',
    Sergeli: 'sergeli',
    Bektemir: 'bektemir',
    Uchtepa: 'uchtepa',
    Olmazor: 'olmazor',
    Shayxontohur: 'shayxontohur',
    Yashnobod: 'yashnobod',
    Yangihayot: 'yangihayot',
  }
  const districtSlug = listing.district ? districtSlugs[listing.district] : undefined
  const useDistrictBreadcrumb = !!category
    && category.slug === 'kvartira-sotiladi'
    && !!districtSlug
    && (listing.city === 'Toshkent' || listing.city === 'Toshkent shahri' || listing.city === 'Toshkent shahar')

  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'RoyalHouse', item: SITE_URL },
    ...(category ? [
      { '@type': 'ListItem', position: 2, name: 'Toshkent', item: `${SITE_URL}/toshkent` },
      ...(useDistrictBreadcrumb ? [
        { '@type': 'ListItem', position: 3, name: listing.district!, item: `${SITE_URL}/toshkent/${districtSlug}/kvartira-sotiladi` },
        { '@type': 'ListItem', position: 4, name: category.name, item: `${SITE_URL}/toshkent/${category.slug}` },
      ] : [
        { '@type': 'ListItem', position: 3, name: category.name, item: `${SITE_URL}/toshkent/${category.slug}` },
      ]),
    ] : [
      { '@type': 'ListItem', position: 2, name: 'E’lonlar', item: `${SITE_URL}/listings` },
    ]),
    { '@type': 'ListItem', position: category ? (useDistrictBreadcrumb ? 5 : 4) : 3, name: title, item: url },
  ]

  const breadcrumbData = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbData) }} />
    <ListingDetailClient listing={{ ...listing, listing_images: images }} />
  </>
}
