export const LISTING_VIDEO_BUCKET = 'listing-videos'

/**
 * Transport safety ceiling only. There is intentionally no 30–50 MB user-facing
 * limit. The browser uploads directly to Storage and a later processing worker
 * creates the optimized playback asset.
 */
export const LISTING_VIDEO_UPLOAD_MAX_BYTES = 1024 * 1024 * 1024

export const LISTING_VIDEO_ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/x-msvideo',
  'video/mpeg',
  'video/3gpp',
  'video/3gpp2',
  'video/x-m4v',
  'video/hevc',
  'video/h265',
])

export function isAcceptedListingVideo(file: { type?: string; size?: number }) {
  const mime = (file.type || '').toLowerCase()
  return mime.startsWith('video/') &&
    LISTING_VIDEO_ALLOWED_MIME_TYPES.has(mime) &&
    Number(file.size || 0) > 0 &&
    Number(file.size || 0) <= LISTING_VIDEO_UPLOAD_MAX_BYTES
}

export function getListingVideoExtension(fileName: string, mimeType: string) {
  const name = fileName.toLowerCase().split('?')[0]
  const existing = name.match(/\.([a-z0-9]{2,5})$/)?.[1]
  if (existing) return existing

  const byMime: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-matroska': 'mkv',
    'video/x-msvideo': 'avi',
    'video/mpeg': 'mpeg',
    'video/3gpp': '3gp',
    'video/3gpp2': '3g2',
    'video/x-m4v': 'm4v',
    'video/hevc': 'hevc',
    'video/h265': 'h265',
  }
  return byMime[mimeType.toLowerCase()] || 'bin'
}

export function getListingVideoOriginalPath(userId: string, listingId: string, mediaId: string, extension: string) {
  return `${userId}/${listingId}/${mediaId}/original.${extension}`
}

export function getListingVideoProcessedPath(userId: string, listingId: string, mediaId: string) {
  return `${userId}/${listingId}/${mediaId}/processed.mp4`
}

export function getListingVideoThumbnailPath(userId: string, listingId: string, mediaId: string) {
  return `${userId}/${listingId}/${mediaId}/thumbnail.webp`
}
