import type { MetadataRoute } from 'next'
import { createClient } from '@/utils/supabase/server'

const SITE_URL = 'https://royalhouse.uz'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/uz`, lastModified: now, changeFrequency: 'daily', priority: 0.95 },
    { url: `${SITE_URL}/ru`, lastModified: now, changeFrequency: 'daily', priority: 0.95 },
    { url: `${SITE_URL}/listings`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/realtors`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/partners`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('listings')
      .select('id,published_at,updated_at')
      .eq('status', 'active')
      .order('published_at', { ascending: false })
      .limit(5000)

    const listingRoutes: MetadataRoute.Sitemap = (data || []).map((listing) => ({
      url: `${SITE_URL}/listings/${encodeURIComponent(listing.id)}`,
      lastModified: listing.updated_at || listing.published_at || now,
      changeFrequency: 'daily',
      priority: 0.8,
    }))

    return [...staticRoutes, ...listingRoutes]
  } catch {
    return staticRoutes
  }
}
