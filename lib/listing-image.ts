export const LISTING_IMAGE_CARD_WIDTH = 640
export const LISTING_IMAGE_CARD_HEIGHT = 480
export const LISTING_IMAGE_CARD_QUALITY = 75

/**
 * Converts a public Supabase Storage object URL into a bounded image-transform
 * URL for listing cards when the rollout flag is enabled.
 *
 * Originals remain untouched in Storage; only the delivery URL is transformed.
 * If transformations are not enabled, the stored URL is returned unchanged.
 */
export function getListingCardImageUrl(imageUrl: string, width = LISTING_IMAGE_CARD_WIDTH, height = LISTING_IMAGE_CARD_HEIGHT) {
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
