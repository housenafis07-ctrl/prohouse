import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params
    if (!UUID_RE.test(listingId)) return NextResponse.json({ error: 'INVALID_LISTING_ID' }, { status: 400 })

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const mediaId = typeof body?.mediaId === 'string' ? body.mediaId : ''
    if (!UUID_RE.test(mediaId)) return NextResponse.json({ error: 'INVALID_MEDIA_ID' }, { status: 400 })

    const { data: media, error } = await db
      .from('listing_media')
      .select('id,listing_id,status,provider,processed_storage_path')
      .eq('id', mediaId)
      .eq('listing_id', listingId)
      .single()
    if (error) throw error
    if (!media?.processed_storage_path) return NextResponse.json({ error: 'VIDEO_PROVIDER_ID_MISSING' }, { status: 409 })
    if (!['uploading', 'processing'].includes(media.status)) return NextResponse.json({ media })

    const { data: updated, error: updateError } = await db
      .from('listing_media')
      .update({ status: 'processing' })
      .eq('id', mediaId)
      .eq('listing_id', listingId)
      .select('id,listing_id,status,provider,processed_storage_path')
      .single()
    if (updateError) throw updateError

    return NextResponse.json({ media: updated })
  } catch (error) {
    console.error('[listing-video/complete]', error)
    return NextResponse.json({ error: 'VIDEO_UPLOAD_COMPLETE_FAILED' }, { status: 500 })
  }
}
