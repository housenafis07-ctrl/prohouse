import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i


async function retirePreviousReadyVideos(
  db: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  currentMediaId: string,
) {
  const { data: previous, error } = await db
    .from('listing_media')
    .select('id,provider,original_storage_path,processed_storage_path')
    .eq('listing_id', listingId)
    .eq('media_type', 'video')
    .eq('status', 'ready')
    .neq('id', currentMediaId)

  if (error) {
    console.error('[listing-video/status] previous video lookup failed', error)
    return
  }
  if (!previous?.length) return

  const previousIds = previous.map(item => item.id)
  const { error: retireError } = await db
    .from('listing_media')
    .update({ status: 'deleted' })
    .eq('listing_id', listingId)
    .in('id', previousIds)

  if (retireError) {
    console.error('[listing-video/status] previous video retirement failed', retireError)
    return
  }

  await Promise.all(previous.map(async item => {
    if (item.provider === 'supabase') {
      const storagePath = item.original_storage_path || item.processed_storage_path
      if (!storagePath) return
      const { error: storageError } = await db.storage.from('listing-videos').remove([storagePath])
      if (storageError) console.error('[listing-video/status] previous Supabase video cleanup failed', {
        mediaId: item.id,
        error: storageError,
      })
      return
    }

    if (item.provider === 'cloudflare' && item.processed_storage_path) {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
      const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim()
      if (!accountId || !apiToken) return

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(item.processed_storage_path)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` }, cache: 'no-store' },
      ).catch(error => {
        console.error('[listing-video/status] previous Cloudflare video cleanup failed', {
          mediaId: item.id,
          error,
        })
        return null
      })

      if (response && !response.ok) {
        console.error('[listing-video/status] previous Cloudflare video cleanup returned an error', {
          mediaId: item.id,
          status: response.status,
        })
      }
    }
  }))
}

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
      .select('id,listing_id,status,provider,processed_storage_path,original_storage_path,playback_url,thumbnail_storage_path,original_mime_type,original_size_bytes')
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
      await retirePreviousReadyVideos(db, listingId, mediaId)
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
    const errorCode = String(video?.status?.errorReasonCode || '').trim()
    const errorMessage = String(video?.status?.errorReasonText || '').trim()

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
      await retirePreviousReadyVideos(db, listingId, mediaId)
      return NextResponse.json({ media: updated, provider: { status: 'ready' } })
    }

    if (failed) {
      await db.from('listing_media').update({ status: 'failed' }).eq('id', mediaId).eq('listing_id', listingId)
      return NextResponse.json({
        media: { ...media, status: 'failed' },
        provider: {
          status: 'failed',
          errorCode: errorCode || null,
          errorMessage: errorMessage || null,
        },
      })
    }

    return NextResponse.json({ media, provider: { status: state || 'processing' } })
  } catch (error) {
    console.error('[listing-video/status]', error)
    return NextResponse.json({ error: 'VIDEO_STATUS_FAILED' }, { status: 500 })
  }
}
