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
 * Converts a public Supabase Storage object URL into a bounded image-transform
 * URL for a specific delivery surface. Originals remain untouched in Storage.
 * If transformations are not enabled, the stored URL is returned unchanged.
 */
export function getListingImageUrl(imageUrl: string, variant: ListingImageVariant = 'card') {
  if (process.env.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS !== 'true') return imageUrl

  try {
    const url = new URL(imageUrl)
    const marker = '/storage/v1/object/public/'
    const index = url.pathname.indexOf(marker)
    if (index === -1) return imageUrl

    const objectPath = url.pathname.slice(index + marker.length)
    if (!objectPath) return imageUrl

    const { width, height, quality } = getVariantOptions(variant)
    url.pathname = `${url.pathname.slice(0, index)}/storage/v1/render/image/public/${objectPath}`
    url.search = ''
    url.searchParams.set('width', String(Math.min(2500, Math.max(1, Math.round(width)))))
    url.searchParams.set('height', String(Math.min(2500, Math.max(1, Math.round(height)))))
    url.searchParams.set('resize', 'cover')
    url.searchParams.set('quality', String(quality))
    return url.toString()
  } catch {
    return imageUrl
  }
}

export function getListingCardImageUrl(imageUrl: string, width = LISTING_IMAGE_CARD_WIDTH, height = LISTING_IMAGE_CARD_HEIGHT) {
  if (width === LISTING_IMAGE_CARD_WIDTH && height === LISTING_IMAGE_CARD_HEIGHT) {
    return getListingImageUrl(imageUrl, 'card')
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS !== 'true') return imageUrl

  try {
    const url = new URL(imageUrl)
    const marker = '/storage/v1/object/public/'
    const index = url.pathname.indexOf(marker)
    if (index === -1) return imageUrl

    const objectPath = url.pathname.slice(index + marker.length)
    if (!objectPath) return imageUrl

    url.pathname = `${url.pathname.slice(0, index)}/storage/v1/render/image/public/${objectPath}`
    url.search = ''
    url.searchParams.set('width', String(Math.min(2500, Math.max(1, Math.round(width)))))
    url.searchParams.set('height', String(Math.min(2500, Math.max(1, Math.round(height)))))
    url.searchParams.set('resize', 'cover')
    url.searchParams.set('quality', String(LISTING_IMAGE_CARD_QUALITY))
    return url.toString()
  } catch {
    return imageUrl
  }
}

export function getListingThumbnailImageUrl(imageUrl: string) {
  return getListingImageUrl(imageUrl, 'thumbnail')
}

export function getListingHeroImageUrl(imageUrl: string) {
  return getListingImageUrl(imageUrl, 'hero')
}
