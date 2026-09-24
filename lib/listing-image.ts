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
  if (variant === 'thumbnail') return { width: LISTING_IMAGE_THUMBNAIL_WIDTH, height: LISTING_IMAGE_THUMBNAIL_HEIGHT, quality: LISTING_IMAGE_THUMBNAIL_QUALITY }
  if (variant === 'hero') return { width: LISTING_IMAGE_HERO_WIDTH, height: LISTING_IMAGE_HERO_HEIGHT, quality: LISTING_IMAGE_HERO_QUALITY }
  return { width: LISTING_IMAGE_CARD_WIDTH, height: LISTING_IMAGE_CARD_HEIGHT, quality: LISTING_IMAGE_CARD_QUALITY }
}

/** Listing images live in a private Supabase bucket and are delivered through an authorization-aware signed-URL proxy. */
export function getListingImageUrl(imageUrl: string, variant: ListingImageVariant = 'card') {
  try {
    const url = new URL(imageUrl)
    if (url.pathname.includes('/storage/v1/object/public/')) {
      const { width, height, quality } = getVariantOptions(variant)
      const params = new URLSearchParams({ url: imageUrl, width: String(width), height: String(height), quality: String(quality) })
      return `/api/listing-images/by-url?${params.toString()}`
    }
    return imageUrl
  } catch {
    return imageUrl
  }
}

export function getListingCardImageUrl(imageUrl: string, _width = LISTING_IMAGE_CARD_WIDTH, _height = LISTING_IMAGE_CARD_HEIGHT) {
  return getListingImageUrl(imageUrl, 'card')
}

export function getListingThumbnailImageUrl(imageUrl: string) {
  return getListingImageUrl(imageUrl, 'thumbnail')
}

export function getListingHeroImageUrl(imageUrl: string) {
  return getListingImageUrl(imageUrl, 'hero')
}
