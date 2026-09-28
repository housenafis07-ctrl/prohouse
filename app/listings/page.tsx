import type { Metadata } from 'next'
import ListingsClient, { type Listing } from './ListingsClient'
import { createClient } from '@/utils/supabase/server'
import { getListingCardImageUrl } from '@/lib/listing-image'

const PAGE_SIZE = 24

type ListingRow = Listing & {
  effective_promotion_rank: number | null
  published_at: string | null
}

function encodeCursor(value: {
  sort: 'newest'
  id: string
  effective_promotion_rank: number
  published_at: string | null
}) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export const revalidate = 60

const SITE_URL = 'https://royalhouse.uz'
const BASE_URL = `${SITE_URL}/listings`

type ListingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ searchParams }: ListingsPageProps): Promise<Metadata> {
  const params = (await searchParams) || {}
  const pageValue = Array.isArray(params.page) ? params.page[0] : params.page
  const page = Math.max(1, Number(pageValue || '1') || 1)
  const hasNonPaginationParams = Object.keys(params).some((key) => key !== 'page')
  const isIndexablePaginationPage = page > 1 && !hasNonPaginationParams

  return {
    title: isIndexablePaginationPage ? `E’lonlar — ${page}-sahifa | Royalhouse` : 'E’lonlar — Royalhouse',
    description: 'O‘zbekistondagi uylar, kvartiralar, hovlilar, yer va tijorat ko‘chmas mulk e’lonlarini toping.',
    alternates: {
      canonical: isIndexablePaginationPage ? `${BASE_URL}?page=${page}` : BASE_URL,
    },
    robots: {
      index: !hasNonPaginationParams,
      follow: true,
    },
  }
}

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const params = (await searchParams) || {}
  const pageValue = Array.isArray(params.page) ? params.page[0] : params.page
  const cursorValue = Array.isArray(params.cursor) ? params.cursor[0] : params.cursor
  const page = Math.max(1, Number(pageValue || '1') || 1)
  const isCleanSeoPage = !cursorValue && Object.keys(params).every((key) => key === 'page')
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('listing_search')
    .select(
      'id,title,title_ru,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,latitude,longitude,seller_type,seller_name,is_mortgage_available,is_verified,is_trusted_seller,is_featured,published_at,taxonomy_code,effective_promotion_rank,effective_promotion_badge',
      { count: 'estimated' },
    )
    .or('listing_type.eq.sale,listing_type.eq.new_building')
    .order('effective_promotion_rank', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(isCleanSeoPage ? (page - 1) * PAGE_SIZE : 0, isCleanSeoPage ? (page - 1) * PAGE_SIZE + PAGE_SIZE : PAGE_SIZE)

  const rows = (data || []) as ListingRow[]
  const hasNext = rows.length > PAGE_SIZE
  const listings = hasNext ? rows.slice(0, PAGE_SIZE) : rows
  const ids = listings.map((listing) => listing.id)

  let images: { listing_id: string; image_url: string; sort_order: number | null }[] = []

  if (ids.length) {
    const { data: imageRows } = await supabase
      .from('listing_images')
      .select('listing_id,image_url,sort_order')
      .in('listing_id', ids)
      .eq('sort_order', 0)
      .order('sort_order', { ascending: true })

    images = imageRows || []
  }

  const firstImageByListing = new Map<string, { image_url: string; sort_order: number | null }>()
  for (const image of images) {
    if (!firstImageByListing.has(image.listing_id)) {
      firstImageByListing.set(image.listing_id, {
        image_url: getListingCardImageUrl(image.image_url),
        sort_order: image.sort_order,
      })
    }
  }

  const initialItems: Listing[] = listings.map((listing) => ({
    ...listing,
    effective_promotion_rank: listing.effective_promotion_rank,
    primary_image: firstImageByListing.get(listing.id) || null,
  }))

  const last = listings[listings.length - 1]
  const initialNextCursor =
    hasNext && last
      ? encodeCursor({
          sort: 'newest',
          id: last.id,
          effective_promotion_rank: Number(last.effective_promotion_rank ?? 0),
          published_at: last.published_at,
        })
      : null

  return (
    <ListingsClient
      initialItems={initialItems}
      initialTotal={count ?? null}
      initialHasNext={hasNext}
      initialNextCursor={initialNextCursor}
    />
  )
}
