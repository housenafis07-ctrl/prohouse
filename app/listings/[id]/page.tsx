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
  promotion_badge?: string | null; promoted_until?: string | null
  published_at: string | null; draft_data?: Record<string, any> | null; listing_images?: ListingImage[]
}

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

async function getListing(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select('id,owner_id,title,title_ru,description,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,address,latitude,longitude,taxonomy_code,seller_type,seller_name,seller_phone,is_mortgage_available,is_verified,is_trusted_seller,is_featured,promotion_badge,promoted_until,published_at,draft_data,listing_images(image_url,sort_order)')
    .eq('id', id).eq('status', 'active').maybeSingle()

  if (error || !data) return null
  return data as Listing
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
  return `${base.replace(/\\s+/g, ' ').trim()} ${details}`.trim().slice(0, 160)
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
    : `${SITE_URL}/og-image.jpg`

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
  const description = (listing.description || `${listing.title} — RoyalHouse ko‘chmas mulk e’loni.`).replace(/\\s+/g, ' ').trim().slice(0, 500)
  const location = [listing.address, listing.district, listing.city].filter(Boolean).join(', ')
  const isRental = listing.listing_type === 'daily' || listing.listing_type === 'rent' || listing.taxonomy_code === 'rent_dacha'

  const structuredData = {
    '@context': 'https://schema.org', '@type': 'RealEstateListing', name: title, description, url,
    image: images.map((image) => image.image_url), datePosted: listing.published_at || undefined,
    ...(location ? { address: { '@type': 'PostalAddress', streetAddress: listing.address || undefined, addressLocality: listing.district || listing.city, addressRegion: listing.city, addressCountry: 'UZ' } } : {}),
    ...(listing.latitude != null && listing.longitude != null ? { geo: { '@type': 'GeoCoordinates', latitude: listing.latitude, longitude: listing.longitude } } : {}),
    offers: { '@type': 'Offer', price: Number(listing.price), priceCurrency: listing.currency === 'USD' ? 'USD' : 'UZS', url, availability: 'https://schema.org/InStock', ...(isRental ? { category: 'Rental' } : {}) },
    ...(listing.seller_name ? { seller: { '@type': 'Person', name: listing.seller_name } } : {}),
  }

  const breadcrumbData = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'RoyalHouse', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'E’lonlar', item: `${SITE_URL}/listings` },
      { '@type': 'ListItem', position: 3, name: title, item: url },
    ],
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbData) }} />
    <ListingDetailClient listing={{ ...listing, listing_images: images }} />
  </>
}
