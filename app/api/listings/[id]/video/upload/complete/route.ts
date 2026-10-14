import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { LISTING_VIDEO_BUCKET } from '@/utils/listing-videos'

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

    const body = await request.json().catch(() => ({}))
    const mediaId = typeof body?.mediaId === 'string' ? body.mediaId : ''
    if (!UUID_RE.test(mediaId)) {
      return NextResponse.json({ error: 'INVALID_MEDIA_ID' }, { status: 400 })
    }

    const { data: media, error: mediaError } = await db
      .from('listing_media')
      .select('id,listing_id,status,original_storage_path,original_size_bytes,original_mime_type')
      .eq('id', mediaId)
      .eq('listing_id', listingId)
      .single()

    if (mediaError) throw mediaError
    if (!media?.original_storage_path) {
      return NextResponse.json({ error: 'VIDEO_UPLOAD_RECORD_INVALID' }, { status: 409 })
    }
    if (!['uploading', 'failed'].includes(media.status)) {
      return NextResponse.json({ error: 'VIDEO_ALREADY_FINALIZED', status: media.status }, { status: 409 })
    }

    const slash = media.original_storage_path.lastIndexOf('/')
    const folder = slash >= 0 ? media.original_storage_path.slice(0, slash) : ''
    const fileName = slash >= 0 ? media.original_storage_path.slice(slash + 1) : media.original_storage_path

    const { data: objects, error: listError } = await db.storage
      .from(LISTING_VIDEO_BUCKET)
      .list(folder, { search: fileName, limit: 10 })

    if (listError) throw listError
    const uploaded = objects?.find((item) => item.name === fileName)
    if (!uploaded) {
      return NextResponse.json({ error: 'VIDEO_NOT_UPLOADED' }, { status: 409 })
    }

    const actualSize = Number(uploaded.metadata?.size ?? 0)
    const actualMime = String(uploaded.metadata?.mimetype ?? media.original_mime_type ?? '').toLowerCase()
    const declaredSize = Number(media.original_size_bytes ?? 0)

    if (!actualSize) {
      return NextResponse.json({ error: 'VIDEO_METADATA_UNAVAILABLE' }, { status: 409 })
    }
    if (declaredSize && Math.abs(actualSize - declaredSize) > 1024) {
      await db.from('listing_media').update({ status: 'failed' }).eq('id', mediaId)
      return NextResponse.json({ error: 'VIDEO_SIZE_MISMATCH' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await db
      .from('listing_media')
      .update({
        status: 'processing',
        size_bytes: actualSize,
        mime_type: actualMime || media.original_mime_type,
      })
      .eq('id', mediaId)
      .eq('listing_id', listingId)
      .select('id,listing_id,status,size_bytes,mime_type,original_storage_path')
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ media: updated })
  } catch (error) {
    console.error('[listing-video/complete]', error)
    return NextResponse.json({ error: 'VIDEO_UPLOAD_COMPLETE_FAILED' }, { status: 500 })
  }
}
