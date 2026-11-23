import type { Metadata } from 'next'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import HomeClient, { type HomeListing } from './components/HomeClient'
import { getListingImageUrl } from '@/lib/listing-image'

const HOME_HERO_IMAGE = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=85'
const HOME_LISTING_FIELDS = [
  'id', 'title', 'title_ru', 'listing_type', 'taxonomy_code', 'property_type',
  'price', 'currency', 'area_m2', 'rooms', 'floor', 'floors_total',
  'district', 'city', 'seller_name', 'is_verified', 'is_mortgage_available',
  'is_featured', 'promotion_badge', 'effective_promotion_badge', 'promoted_until',
  'published_at', 'effective_promotion_rank',
].join(',')

export const metadata: Metadata = {
  title: 'Royalhouse — Ko‘chmas mulk platformasi',
  description: 'O‘zbekistonda uy topish, sotish, ijaraga olish va ipoteka uchun zamonaviy platforma.',
  alternates: {
    canonical: 'https://royalhouse.uz/',
    languages: {
      uz: 'https://royalhouse.uz/uz',
      ru: 'https://royalhouse.uz/ru',
      'x-default': 'https://royalhouse.uz/',
    },
  },
  openGraph: {
    locale: 'uz_UZ',
    url: 'https://royalhouse.uz/',
    siteName: 'Royalhouse',
    title: 'Royalhouse — Ko‘chmas mulk platformasi',
    description: 'O‘zbekistonda uy topish, sotish, ijaraga olish va ipoteka uchun zamonaviy platforma.',
  },
}

async function loadHomeListings(): Promise<{ listings: HomeListing[]; activeCount: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    console.error('[home-listings] Supabase public configuration is missing')
    return { listings: [], activeCount: 0 }
  }

  try {
    const db = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          next: { revalidate: 30 },
        } as RequestInit),
      },
    })

    // Production's current listing_search view omits primary_image_url and
    // land_area. Fetch the two small public projections in parallel, rather
    // than waiting for listing IDs and then starting a second request.
    const [listingResult, imageResult] = await Promise.all([
      db
        .from('listing_search')
        .select(HOME_LISTING_FIELDS, { count: 'exact' })
        .eq('status', 'active')
        .order('effective_promotion_rank', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(60),
      db
        .from('listings')
        .select('id,primary_image_url,land_area')
        .eq('status', 'active')
        .limit(1000),
    ])

    if (listingResult.error) {
      console.error('[home-listings] query failed', listingResult.error.message)
      return { listings: [], activeCount: 0 }
    }

    if (imageResult.error) {
      console.warn('[home-listings] image metadata query failed', imageResult.error.message)
    }

    const imageById = new Map((imageResult.data || []).map((row: any) => [String(row.id), row]))
    const listings: HomeListing[] = (listingResult.data || []).map((row: any) => {
      const image = imageById.get(String(row.id))
      return {
        ...row,
        land_area: image?.land_area ?? null,
        promotion_badge: row.effective_promotion_badge ?? row.promotion_badge ?? null,
        image_url: image?.primary_image_url ? getListingImageUrl(image.primary_image_url, 'card') : undefined,
      }
    })

    return { listings, activeCount: listingResult.count ?? listings.length }
  } catch (error) {
    console.error('[home-listings] unexpected query failure', error)
    return { listings: [], activeCount: 0 }
  }
}

export default async function HomePage() {
  const { listings, activeCount } = await loadHomeListings()

  return (
    <>
      <link rel="preconnect" href="https://images.unsplash.com" />
      <link rel="preload" as="image" href={HOME_HERO_IMAGE} />
      <HomeClient initialListings={listings} initialActiveCount={activeCount} />
    </>
  )
}
