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

    const tashkentSeoPages = [
      ['kvartira-sotiladi', 'sale', 'apartment'],
      ['uy-sotiladi', 'sale', 'house'],
      ['kvartira-ijara', 'rent', 'apartment'],
      ['uy-ijara', 'rent', 'house'],
      ['novostroyka', 'sale', 'new_building'],
      ['yer-sotiladi', 'sale', 'land'],
      ['tijorat', 'sale', 'commercial'],
    ] as const

    const cityFilter = 'city.eq.Toshkent,city.eq.Toshkent shahri,city.eq.Toshkent shahar'
    function districtVariants(district: string) {
      const variants = new Set<string>([district])
      const withoutSuffix = district.replace(/\s+(tumani|shahri)$/i, '').trim()
      if (withoutSuffix) {
        variants.add(withoutSuffix)
        variants.add(`${withoutSuffix} tumani`)
        variants.add(`${withoutSuffix} shahri`)
      }
      variants.add(district.replace(/'/g, '‘'))
      variants.add(district.replace(/‘/g, "'"))
      return Array.from(variants)
    }

    const districtSeoPages = [
      ['yunusobod', 'Yunusobod', 'kvartira-sotiladi'],
      ['chilonzor', 'Chilonzor', 'kvartira-sotiladi'],
      ['mirobod', 'Mirobod', 'kvartira-sotiladi'],
      ['yakkasaroy', 'Yakkasaroy', 'kvartira-sotiladi'],
      ['mirzo-ulugbek', 'Mirzo Ulug‘bek', 'kvartira-sotiladi'],
      ['sergeli', 'Sergeli', 'kvartira-sotiladi'],
      ['bektemir', 'Bektemir', 'kvartira-sotiladi'],
      ['uchtepa', 'Uchtepa', 'kvartira-sotiladi'],
      ['olmazor', 'Olmazor', 'kvartira-sotiladi'],
      ['shayxontohur', 'Shayxontohur', 'kvartira-sotiladi'],
      ['yashnobod', 'Yashnobod', 'kvartira-sotiladi'],
      ['yangihayot', 'Yangihayot', 'kvartira-sotiladi'],
    ] as const

    const districtSeoRoutes = (
      await Promise.all(
        districtSeoPages.map(async ([slug, district, category]) => {
          const { count } = await supabase
            .from('listing_search')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active')
            .or(cityFilter)
            .in('district', districtVariants(district))
            .eq('listing_type', 'sale')
            .eq('property_type', 'apartment')
          return count ? { url: `${SITE_URL}/toshkent/${slug}/${category}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 } : null
        }),
      )
    ).filter(Boolean) as MetadataRoute.Sitemap

    const seoRoutes = (
      await Promise.all(
        tashkentSeoPages.map(async ([slug, listingType, propertyType]) => {
          const { count } = await supabase
            .from('listing_search')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active')
            .or(cityFilter)
            .eq('listing_type', listingType)
            .eq('property_type', propertyType)
          return count ? { url: `${SITE_URL}/toshkent/${slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.85 } : null
        }),
      )
    ).filter(Boolean) as MetadataRoute.Sitemap
    const { data } = await supabase
      .from('listings')
      .select('id,published_at,updated_at')
      .eq('status', 'active')
      .in('listing_type', ['sale', 'rent', 'daily'])
      .order('published_at', { ascending: false })
      .limit(5000)

    const listingRoutes: MetadataRoute.Sitemap = (data || []).map((listing) => ({
      url: `${SITE_URL}/listings/${encodeURIComponent(listing.id)}`,
      lastModified: listing.updated_at || listing.published_at || now,
      changeFrequency: 'daily',
      priority: 0.8,
    }))

    return [...staticRoutes, { url: `${SITE_URL}/toshkent`, lastModified: now, changeFrequency: 'daily', priority: 0.9 }, ...seoRoutes, ...districtSeoRoutes, ...listingRoutes]
  } catch {
    return staticRoutes
  }
}
