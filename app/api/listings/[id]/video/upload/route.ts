import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  getListingVideoExtension,
  getListingVideoOriginalPath,
  isAcceptedListingVideo,
  LISTING_VIDEO_BUCKET,
  LISTING_VIDEO_UPLOAD_MAX_BYTES,
} from '@/utils/listing-videos'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: listingId } = await params
    if (!UUID_RE.test(listingId)) {
      return NextResponse.json({ error: 'INVALID_LISTING_ID' }, { status: 400 })
    }

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const { data: listing, error: listingError } = await db
      .from('listings')
      .select('id,owner_id,status')
      .eq('id', listingId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (listingError) throw listingError
    if (!listing) return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 })

    const body = await request.json()
    const fileName = typeof body?.fileName === 'string' ? body.fileName : ''
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType.toLowerCase() : ''
    const sizeBytes = Number(body?.sizeBytes)

    if (!fileName || !isAcceptedListingVideo({ type: mimeType, size: sizeBytes })) {
      return NextResponse.json({
        error: 'UNSUPPORTED_VIDEO',
        message: 'Video formati qo‘llab-quvvatlanmaydi yoki fayl hajmi ruxsat etilgan chegaradan oshgan.',
        maxBytes: LISTING_VIDEO_UPLOAD_MAX_BYTES,
      }, { status: 400 })
    }

    const mediaId = crypto.randomUUID()
    const extension = getListingVideoExtension(fileName, mimeType)
    const originalPath = getListingVideoOriginalPath(user.id, listingId, mediaId, extension)

    const { data: media, error: mediaError } = await db
      .from('listing_media')
      .insert({
        id: mediaId,
        listing_id: listingId,
        media_type: 'video',
        provider: 'supabase',
        status: 'uploading',
        original_storage_path: originalPath,
        original_mime_type: mimeType,
        original_size_bytes: sizeBytes,
        sort_order: 0,
      })
      .select('id,listing_id,status,original_storage_path,original_mime_type,original_size_bytes')
      .single()

    if (mediaError) {
      if (mediaError.code === '23505') {
        return NextResponse.json({
          error: 'VIDEO_ALREADY_EXISTS',
          message: 'Bu e’lon uchun video yuklanmoqda yoki allaqachon mavjud.',
        }, { status: 409 })
      }
      throw mediaError
    }

    const { data: signedUpload, error: signedUploadError } = await db.storage
      .from(LISTING_VIDEO_BUCKET)
      .createSignedUploadUrl(originalPath)

    if (signedUploadError || !signedUpload) {
      await db.from('listing_media').delete().eq('id', mediaId)
      throw signedUploadError || new Error('SIGNED_UPLOAD_URL_FAILED')
    }

    return NextResponse.json({
      media,
      upload: {
        bucket: LISTING_VIDEO_BUCKET,
        path: originalPath,
        token: signedUpload.token,
      },
    })
  } catch (error) {
    console.error('[listing-video/upload]', error)
    return NextResponse.json({ error: 'VIDEO_UPLOAD_INIT_FAILED' }, { status: 500 })
  }
}
