export const LISTING_IMAGE_CARD_WIDTH = 640
export const LISTING_IMAGE_CARD_HEIGHT = 480
export const LISTING_IMAGE_CARD_QUALITY = 75

export const LISTING_IMAGE_THUMBNAIL_WIDTH = 240
export const LISTING_IMAGE_THUMBNAIL_HEIGHT = 180
export const LISTING_IMAGE_THUMBNAIL_QUALITY = 70

export const LISTING_IMAGE_HERO_WIDTH = 1600
export const LISTING_IMAGE_HERO_HEIGHT = 1200
export const LISTING_IMAGE_HERO_QUALITY = 82

type ListingImageVariant = 'card' | 'thumbnail' | 'hero'

function getVariantOptions(variant: ListingImageVariant) {
  if (variant === 'thumbnail') {
    return {
      width: LISTING_IMAGE_THUMBNAIL_WIDTH,
      height: LISTING_IMAGE_THUMBNAIL_HEIGHT,
      quality: LISTING_IMAGE_THUMBNAIL_QUALITY,
    }
  }

  if (variant === 'hero') {
    return {
      width: LISTING_IMAGE_HERO_WIDTH,
      height: LISTING_IMAGE_HERO_HEIGHT,
      quality: LISTING_IMAGE_HERO_QUALITY,
    }
  }

  return {
    width: LISTING_IMAGE_CARD_WIDTH,
    height: LISTING_IMAGE_CARD_HEIGHT,
    quality: LISTING_IMAGE_CARD_QUALITY,
  }
}

/**
 * Listing images are stored in a private Supabase bucket. The database keeps
 * the canonical object URL, but browsers must receive a short-lived signed
 * URL through our authorization-aware proxy. External image URLs are kept
 * unchanged.
 */
export function getListingImageUrl(imageUrl: string, variant: ListingImageVariant = 'card') {
  try {
    const url = new URL(imageUrl)
    const marker = '/storage/v1/object/public/'
    if (url.pathname.includes(marker)) {
      const { width, height, quality } = getVariantOptions(variant)
      const proxy = new URL('/api/listing-images/by-url', typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      proxy.searchParams.set('url', imageUrl)
      proxy.searchParams.set('width', String(width))
      proxy.searchParams.set('height', String(height))
      proxy.searchParams.set('quality', String(quality))
      return proxy.toString()
    }
    return imageUrl
  } catch {
    return imageUrl
  }
}

export function getListingCardImageUrl(imageUrl: string, width = LISTING_IMAGE_CARD_WIDTH, height = LISTING_IMAGE_CARD_HEIGHT) {
  return getListingImageUrl(imageUrl, 'card')
}

export function getListingThumbnailImageUrl(imageUrl: string) {
  return getListingImageUrl(imageUrl, 'thumbnail')
}

export function getListingHeroImageUrl(imageUrl: string) {
  return getListingImageUrl(imageUrl, 'hero')
}
