import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params
    if (!UUID_RE.test(listingId)) return NextResponse.json({ error: 'INVALID_LISTING_ID' }, { status: 400 })

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const mediaId = request.nextUrl.searchParams.get('mediaId') || ''
    if (!UUID_RE.test(mediaId)) return NextResponse.json({ error: 'INVALID_MEDIA_ID' }, { status: 400 })

    const { data: media, error } = await db
      .from('listing_media')
      .select('id,listing_id,status,provider,processed_storage_path,playback_url,thumbnail_storage_path')
      .eq('id', mediaId)
      .eq('listing_id', listingId)
      .single()
    if (error) throw error

    if (media.provider !== 'cloudflare' || !media.processed_storage_path) return NextResponse.json({ media })

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN
    if (!accountId || !apiToken) return NextResponse.json({ error: 'VIDEO_PROCESSING_ENV_MISSING' }, { status: 503 })

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${media.processed_storage_path}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      cache: 'no-store',
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success || !result?.result) return NextResponse.json({ media, provider: { status: 'unknown' } })

    const video = result.result
    const state = String(video?.status?.state || '').toLowerCase()
    const ready = state === 'ready'
    const failed = state === 'error'
    const uid = media.processed_storage_path

    if (ready) {
      const playbackUrl = `https://iframe.videodelivery.net/${uid}`
      const thumbnailUrl = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`
      const { data: updated, error: updateError } = await db
        .from('listing_media')
        .update({
          status: 'ready',
          playback_url: playbackUrl,
          thumbnail_storage_path: thumbnailUrl,
          duration_seconds: Number(video.duration || 0) || null,
          width: Number(video.input?.width || video.meta?.width || 0) || null,
          height: Number(video.input?.height || video.meta?.height || 0) || null,
          mime_type: 'video/mp4',
        })
        .eq('id', mediaId)
        .eq('listing_id', listingId)
        .select('id,listing_id,status,provider,playback_url,thumbnail_storage_path,processed_storage_path,duration_seconds,width,height')
        .single()
      if (updateError) throw updateError
      return NextResponse.json({ media: updated, provider: { status: 'ready' } })
    }

    if (failed) {
      await db.from('listing_media').update({ status: 'failed' }).eq('id', mediaId).eq('listing_id', listingId)
      return NextResponse.json({ media: { ...media, status: 'failed' }, provider: { status: 'failed' } })
    }

    return NextResponse.json({ media, provider: { status: state || 'processing' } })
  } catch (error) {
    console.error('[listing-video/status]', error)
    return NextResponse.json({ error: 'VIDEO_STATUS_FAILED' }, { status: 500 })
  }
}
