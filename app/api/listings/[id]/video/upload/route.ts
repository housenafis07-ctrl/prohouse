import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024 * 1024
const MAX_DURATION_SECONDS = 60
const TUS_THRESHOLD_BYTES = 200 * 1024 * 1024

const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  qt: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  flv: 'video/x-flv',
  ts: 'video/mp2t',
  mts: 'video/mp2t',
  m2ts: 'video/mp2t',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  mxf: 'application/mxf',
  lxf: 'video/x-lxf',
  gxf: 'video/gxf',
  '3gp': 'video/3gpp',
  hevc: 'video/hevc',
  h265: 'video/hevc',
}

function inferMimeType(fileName: string, mimeType: string) {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized.startsWith('video/')) return normalized

  const extension = fileName.split('.').pop()?.toLowerCase() || ''
  return VIDEO_MIME_BY_EXTENSION[extension] || ''
}

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
    const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : ''
    const rawMimeType = typeof body?.mimeType === 'string' ? body.mimeType : ''
    const mimeType = inferMimeType(fileName, rawMimeType)
    const sizeBytes = Number(body?.sizeBytes)

    if (!fileName || !mimeType || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes >= MAX_UPLOAD_BYTES) {
      return NextResponse.json({
        error: 'UNSUPPORTED_VIDEO',
        message: 'Video formati qo‘llab-quvvatlanmaydi yoki fayl hajmi 30 GB dan oshgan.',
        maxBytes: MAX_UPLOAD_BYTES,
      }, { status: 400 })
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
    const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim()

    if (!accountId || !apiToken) {
      console.error('[listing-video/upload] Cloudflare Stream environment is missing', {
        hasAccountId: Boolean(accountId),
        hasApiToken: Boolean(apiToken),
      })
      return NextResponse.json({
        error: 'VIDEO_PROCESSING_ENV_MISSING',
        message: 'Cloudflare Stream konfiguratsiyasi serverda mavjud emas.',
      }, { status: 503 })
    }

    const mediaId = crypto.randomUUID()
    const cloudflareBase = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream`
    let uploadUrl = ''
    let providerId = ''
    let protocol: 'post' | 'tus'

    // Cloudflare recommends ordinary direct POST for reliable uploads below 200 MB.
    // This avoids unnecessary TUS/CORS/offset handling for the common phone-video case.
    if (sizeBytes < TUS_THRESHOLD_BYTES) {
      protocol = 'post'
      const uploadResponse = await fetch(`${cloudflareBase}/direct_upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: MAX_DURATION_SECONDS,
          creator: user.id,
          thumbnailTimestampPct: 0.1,
          requireSignedURLs: false,
          meta: { name: fileName },
        }),
        cache: 'no-store',
      })

      const providerBody = await uploadResponse.json().catch(() => null)
      uploadUrl = providerBody?.result?.uploadURL || ''
      providerId = providerBody?.result?.uid || ''

      if (!uploadResponse.ok || !providerBody?.success || !uploadUrl || !providerId) {
        console.error('[listing-video/upload] cloudflare direct upload init failed', {
          status: uploadResponse.status,
          body: JSON.stringify(providerBody).slice(0, 800),
        })
        return NextResponse.json({
          error: 'VIDEO_UPLOAD_PROVIDER_INIT_FAILED',
          message: 'Cloudflare Stream yuklash sessiyasini yaratib bo‘lmadi.',
          providerStatus: uploadResponse.status,
        }, { status: 502 })
      }
    } else {
      protocol = 'tus'

      // TUS metadata keys are case-sensitive in practice. Use the API's
      // documented lowercase names for the TUS upload endpoint.
      const uploadMetadata = [
        `name ${base64(fileName)}`,
        `thumbnailtimestamppct ${base64('0.1')}`,
        `maxdurationseconds ${base64(String(MAX_DURATION_SECONDS))}`,
      ].join(',')

      const uploadResponse = await fetch(`${cloudflareBase}?direct_user=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': String(sizeBytes),
          'Upload-Creator': user.id,
          'Upload-Metadata': uploadMetadata,
        },
        cache: 'no-store',
      })

      uploadUrl = uploadResponse.headers.get('Location') || ''
      providerId = uploadResponse.headers.get('stream-media-id') || ''

      if (!uploadResponse.ok || !uploadUrl || !providerId) {
        const providerBody = await uploadResponse.text().catch(() => '')
        console.error('[listing-video/upload] cloudflare tus init failed', {
          status: uploadResponse.status,
          body: providerBody.slice(0, 800),
        })

        return NextResponse.json({
          error: 'VIDEO_UPLOAD_PROVIDER_INIT_FAILED',
          message: 'Cloudflare Stream yuklash sessiyasini yaratib bo‘lmadi.',
          providerStatus: uploadResponse.status,
        }, { status: 502 })
      }
    }

    const { data: media, error: mediaError } = await db
      .from('listing_media')
      .insert({
        id: mediaId,
        listing_id: listingId,
        media_type: 'video',
        provider: 'cloudflare',
        status: 'uploading',
        processed_storage_path: providerId,
        original_mime_type: mimeType,
        original_size_bytes: sizeBytes,
        sort_order: 0,
      })
      .select('id,listing_id,status,provider,processed_storage_path,original_mime_type,original_size_bytes')
      .single()

    if (mediaError) {
      console.error('[listing-video/upload] database insert failed', mediaError)
      return NextResponse.json({ error: 'VIDEO_MEDIA_RECORD_FAILED' }, { status: 500 })
    }

    return NextResponse.json({
      media,
      upload: {
        protocol,
        url: uploadUrl,
        providerId,
        chunkSize: protocol === 'tus' ? 50 * 1024 * 1024 : null,
      },
    })
  } catch (error) {
    console.error('[listing-video/upload]', error)
    return NextResponse.json({ error: 'VIDEO_UPLOAD_INIT_FAILED' }, { status: 500 })
  }
}
