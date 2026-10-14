import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_DURATION_SECONDS = 60

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
      .select('id,listing_id,status,provider,original_storage_path,processed_storage_path,playback_url,thumbnail_storage_path,original_mime_type,original_size_bytes')
      .eq('id', mediaId)
      .eq('listing_id', listingId)
      .single()
    if (error) throw error

    if (media.provider === 'supabase' && media.processed_storage_path) {
      if (media.status === 'uploading') return NextResponse.json({ media, provider: { status: 'uploading' } })

      const { data: signed, error: signError } = await db.storage
        .from('listing-videos')
        .createSignedUrl(media.processed_storage_path, 24 * 60 * 60)
      if (signError || !signed?.signedUrl) {
        console.error('[listing-video/status] supabase signed playback failed', signError)
        return NextResponse.json({ error: 'VIDEO_STATUS_FAILED' }, { status: 500 })
      }

      const { data: updated, error: updateError } = await db
        .from('listing_media')
        .update({
          status: 'ready',
          playback_url: signed.signedUrl,
          mime_type: media.original_mime_type || 'application/octet-stream',
          size_bytes: media.original_size_bytes,
        })
        .eq('id', mediaId)
        .eq('listing_id', listingId)
        .select('id,listing_id,status,provider,playback_url,thumbnail_storage_path,processed_storage_path,duration_seconds,width,height')
        .single()
      if (updateError) throw updateError
      return NextResponse.json({ media: updated, provider: { status: 'ready' } })
    }

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
    const sourceUid = media.original_storage_path || uid

    if (ready) {
      const duration = Number(video.duration || 0) || 0

      // The browser may report a video longer than 60 seconds, and Cloudflare
      // correctly preserves that source. Instead of rejecting the listing,
      // create a Cloudflare clip containing the first 60 seconds. The source
      // UID stays in original_storage_path so it can be cleaned up later.
      if (duration > MAX_DURATION_SECONDS && sourceUid === uid) {
        const clipResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/clip`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clippedFromVideoUID: uid,
            startTimeSeconds: 0,
            endTimeSeconds: MAX_DURATION_SECONDS,
            creator: user.id,
            requireSignedURLs: false,
            meta: { name: `royalhouse-${mediaId}-60s.mp4` },
          }),
          cache: 'no-store',
        })
        const clipResult = await clipResponse.json().catch(() => null)
        const clipUid = clipResult?.result?.uid || ''

        if (!clipResponse.ok || !clipResult?.success || !clipUid) {
          console.error('[listing-video/status] cloudflare clip failed', {
            status: clipResponse.status,
            body: JSON.stringify(clipResult).slice(0, 800),
          })
          await db.from('listing_media').update({ status: 'failed' }).eq('id', mediaId).eq('listing_id', listingId)
          return NextResponse.json({ media: { ...media, status: 'failed' }, provider: { status: 'failed' }, error: 'VIDEO_CLIP_FAILED' })
        }

        const { data: clipping, error: clippingError } = await db
          .from('listing_media')
          .update({
            status: 'processing',
            processed_storage_path: clipUid,
            playback_url: null,
            thumbnail_storage_path: null,
            duration_seconds: null,
            width: null,
            height: null,
          })
          .eq('id', mediaId)
          .eq('listing_id', listingId)
          .select('id,listing_id,status,provider,processed_storage_path,original_storage_path')
          .single()

        if (clippingError) throw clippingError
        return NextResponse.json({ media: clipping, provider: { status: 'processing' }, autoTrimmed: true })
      }

      const playbackUrl = `https://iframe.videodelivery.net/${uid}`
      const thumbnailUrl = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`
      const { data: updated, error: updateError } = await db
        .from('listing_media')
        .update({
          status: 'ready',
          playback_url: playbackUrl,
          thumbnail_storage_path: thumbnailUrl,
          duration_seconds: duration || null,
          width: Number(video.input?.width || video.meta?.width || 0) || null,
          height: Number(video.input?.height || video.meta?.height || 0) || null,
          mime_type: 'video/mp4',
        })
        .eq('id', mediaId)
        .eq('listing_id', listingId)
        .select('id,listing_id,status,provider,playback_url,thumbnail_storage_path,processed_storage_path,duration_seconds,width,height')
        .single()
      if (updateError) throw updateError

      // Once the 60-second clip is ready, the original longer source is no
      // longer needed. Remove it asynchronously; a cleanup failure must not
      // make the listing video unusable.
      if (sourceUid && sourceUid !== uid) {
        await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${sourceUid}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${apiToken}` },
        }).catch(error => console.error('[listing-video/status] source cleanup failed', error))
      }

      return NextResponse.json({ media: updated, provider: { status: 'ready' }, autoTrimmed: sourceUid !== uid })
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
