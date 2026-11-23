import type { Metadata } from 'next'
import ListingsClient, { type Listing } from './ListingsClient'
import { createClient } from '@/utils/supabase/server'
import { getListingCardImageUrl } from '@/lib/listing-image'

const PAGE_SIZE = 24
const SITE_URL = 'https://royalhouse.uz'

type SeoTab = 'sale' | 'rent' | 'daily' | 'new_building'

type ListingRow = Listing & {
  effective_promotion_rank: number | null
  published_at: string | null
}

const SEO_ROUTES: Record<SeoTab, { path: string; title: string; description: string }> = {
  sale: {
    path: '/sotuv',
    title: 'Uylar va kvartiralar sotuvda | Royalhouse',
    description: 'O‘zbekistonda sotilayotgan uylar, kvartiralar, hovlilar, yer va tijorat ko‘chmas mulk e’lonlarini toping.',
  },
  rent: {
    path: '/ijara',
    title: 'Uylar va kvartiralar ijaraga | Royalhouse',
    description: 'Toshkent va O‘zbekistonda ijaraga berilayotgan uylar va kvartiralarni toping.',
  },
  daily: {
    path: '/kunlik',
    title: 'Kunlik uy va dacha ijarasi | Royalhouse',
    description: 'Toshkent va O‘zbekistonda kunlik uylar, dachalar va dam olish maskanlarini toping.',
  },
  new_building: {
    path: '/yangi-uylar',
    title: 'Yangi uylar va novostroykalar | Royalhouse',
    description: 'O‘zbekistondagi yangi qurilishlar, novostroykalar va yangi xonadonlarni toping.',
  },
}

function encodeCursor(value: {
  sort: 'newest'
  id: string
  effective_promotion_rank: number
  published_at: string | null
}) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function applyTabFilter(query: any, tab: SeoTab) {
  if (tab === 'new_building') return query.eq('listing_type', 'new_building')
  return query.eq('listing_type', tab)
}

export function getSeoListingsMetadata(tab: SeoTab): Metadata {
  const seo = SEO_ROUTES[tab]
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `${SITE_URL}${seo.path}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: `${SITE_URL}${seo.path}`,
      siteName: 'Royalhouse',
      locale: 'uz_UZ',
    },
  }
}

type SeoListingsPageProps = {
  tab: SeoTab
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SeoListingsPage({ tab, searchParams }: SeoListingsPageProps) {
  const params = (await searchParams) || {}
  const pageValue = Array.isArray(params.page) ? params.page[0] : params.page
  const page = Math.max(1, Number(pageValue || '1') || 1)
  const supabase = await createClient()
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('listing_search')
    .select(
      'id,title,title_ru,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,latitude,longitude,seller_type,seller_name,is_mortgage_available,is_verified,is_trusted_seller,is_featured,published_at,taxonomy_code,effective_promotion_rank,effective_promotion_badge',
      { count: 'estimated' },
    )

  query = applyTabFilter(query, tab)

  const { data, count } = await query
    .order('effective_promotion_rank', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE)

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
