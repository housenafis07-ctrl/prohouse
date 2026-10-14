import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024 * 1024
const MAX_DURATION_SECONDS = 60

function base64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params
    if (!UUID_RE.test(listingId)) return NextResponse.json({ error: 'INVALID_LISTING_ID' }, { status: 400 })

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

    const body = await request.json().catch(() => ({}))
    const fileName = typeof body?.fileName === 'string' ? body.fileName : ''
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType.toLowerCase() : ''
    const sizeBytes = Number(body?.sizeBytes)
    if (!fileName || !mimeType.startsWith('video/') || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'UNSUPPORTED_VIDEO', message: 'Video formati qo‘llab-quvvatlanmaydi yoki Cloudflare Stream maksimal fayl hajmidan oshgan.', maxBytes: MAX_UPLOAD_BYTES }, { status: 400 })
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (!accountId || !apiToken || !siteUrl) return NextResponse.json({ error: 'VIDEO_PROCESSING_ENV_MISSING' }, { status: 503 })

    const mediaId = crypto.randomUUID()
    const origin = new URL(siteUrl).hostname
    const uploadMetadata = [
      `name ${base64(fileName)}`,
      `requiresignedurls ${base64('true')}`,
      `allowedorigins ${base64(origin)}`,
      `thumbnailtimestamppct ${base64('0.1')}`,
      `maxdurationseconds ${base64(String(MAX_DURATION_SECONDS))}`,
    ].join(',')

    const uploadResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(sizeBytes),
        'Upload-Creator': user.id,
        'Upload-Metadata': uploadMetadata,
      },
    })

    const uploadUrl = uploadResponse.headers.get('Location')
    const providerId = uploadResponse.headers.get('stream-media-id')
    if (!uploadResponse.ok || !uploadUrl || !providerId) {
      console.error('[listing-video/upload] cloudflare tus init failed', uploadResponse.status)
      return NextResponse.json({ error: 'VIDEO_UPLOAD_PROVIDER_INIT_FAILED' }, { status: 502 })
    }

    const { data: media, error: mediaError } = await db
      .from('listing_media')
      .insert({ id: mediaId, listing_id: listingId, media_type: 'video', provider: 'cloudflare', status: 'uploading', processed_storage_path: providerId, original_mime_type: mimeType, original_size_bytes: sizeBytes, sort_order: 0 })
      .select('id,listing_id,status,provider,processed_storage_path,original_mime_type,original_size_bytes')
      .single()

    if (mediaError) {
      console.error('[listing-video/upload] database insert failed', mediaError)
      return NextResponse.json({ error: 'VIDEO_MEDIA_RECORD_FAILED' }, { status: 500 })
    }

    return NextResponse.json({ media, upload: { protocol: 'tus', url: uploadUrl, providerId, chunkSize: 50 * 1024 * 1024 } })
  } catch (error) {
    console.error('[listing-video/upload]', error)
    return NextResponse.json({ error: 'VIDEO_UPLOAD_INIT_FAILED' }, { status: 500 })
  }
}
