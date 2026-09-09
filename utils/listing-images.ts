export const LISTING_IMAGE_BUCKET = 'listing-images'
export const LISTING_IMAGE_MAX_SIZE = 10 * 1024 * 1024
export const LISTING_IMAGE_ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const LISTING_IMAGE_ACCEPT = LISTING_IMAGE_ACCEPTED_MIME_TYPES.join(',')

export const isAcceptedListingImage = (file: File) =>
  LISTING_IMAGE_ACCEPTED_MIME_TYPES.includes(file.type as (typeof LISTING_IMAGE_ACCEPTED_MIME_TYPES)[number])

export const getListingImageStoragePath = (userId: string, listingId: string, fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg'
  return `${userId}/${listingId}/${crypto.randomUUID()}.${extension}`
}
