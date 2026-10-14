import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { LISTING_VIDEO_BUCKET } from '@/utils/listing-videos'

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
      .select('id,listing_id,status,original_storage_path')
      .eq('id', mediaId)
      .eq('listing_id', listingId)
      .single()
    if (error) throw error
    if (!media?.original_storage_path) return NextResponse.json({ error: 'VIDEO_RECORD_INVALID' }, { status: 409 })
    if (!['processing', 'failed'].includes(media.status)) return NextResponse.json({ error: 'VIDEO_NOT_READY', status: media.status }, { status: 409 })

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (!accountId || !apiToken || !siteUrl) return NextResponse.json({ error: 'VIDEO_PROCESSING_ENV_MISSING' }, { status: 503 })

    const { data: signed, error: signError } = await db.storage
      .from(LISTING_VIDEO_BUCKET)
      .createSignedUrl(media.original_storage_path, 3600)
    if (signError || !signed?.signedUrl) throw signError || new Error('SOURCE_SIGNED_URL_FAILED')

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: signed.signedUrl,
        creator: user.id,
        meta: { listingId, mediaId, source: 'royalhouse' },
        allowedOrigins: [new URL(siteUrl).hostname],
        thumbnailTimestampPct: 0.1,
      }),
    })

    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success || !result?.result?.uid) {
      await db.from('listing_media').update({ status: 'failed' }).eq('id', mediaId)
      return NextResponse.json({ error: 'VIDEO_PROCESSING_START_FAILED' }, { status: 502 })
    }

    const uid = result.result.uid as string
    const playbackUrl = `https://iframe.videodelivery.net/${uid}`
    const thumbnailUrl = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`

    const { data: updated, error: updateError } = await db
      .from('listing_media')
      .update({
        provider: 'cloudflare',
        status: 'processing',
        playback_url: playbackUrl,
        thumbnail_storage_path: thumbnailUrl,
        processed_storage_path: uid,
      })
      .eq('id', mediaId)
      .eq('listing_id', listingId)
      .select('id,listing_id,status,provider,playback_url,thumbnail_storage_path,processed_storage_path')
      .single()
    if (updateError) throw updateError

    return NextResponse.json({ media: updated, providerId: uid })
  } catch (error) {
    console.error('[listing-video/process]', error)
    return NextResponse.json({ error: 'VIDEO_PROCESSING_FAILED' }, { status: 500 })
  }
}
