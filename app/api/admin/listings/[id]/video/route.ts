import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin('listings.moderate')
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const { id } = await params
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'INVALID_LISTING_ID' }, { status: 400 })

    const db = serviceClient()
    const { data: media, error: mediaError } = await db
      .from('listing_media')
      .select('id,status,provider,processed_storage_path,playback_url,thumbnail_storage_path,duration_seconds,width,height,sort_order')
      .eq('listing_id', id)
      .eq('media_type', 'video')
      .in('status', ['ready', 'processing', 'uploading'])
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (mediaError) throw mediaError
    if (!media) return NextResponse.json({ media: null })

    if (media.provider === 'supabase' && media.processed_storage_path && media.status === 'ready') {
      const { data: signed, error: signError } = await db.storage
        .from('listing-videos')
        .createSignedUrl(media.processed_storage_path, 60 * 60)
      if (signError || !signed?.signedUrl) throw signError || new Error('VIDEO_SIGNED_URL_FAILED')
      return NextResponse.json({ media: { ...media, playback_url: signed.signedUrl } })
    }

    const uid = media.processed_storage_path
    const playbackUrl = media.playback_url || (uid ? `https://iframe.videodelivery.net/${uid}` : null)
    const thumbnailUrl = media.thumbnail_storage_path || (uid ? `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg` : null)

    return NextResponse.json({ media: playbackUrl || thumbnailUrl ? { ...media, playback_url: playbackUrl, thumbnail_storage_path: thumbnailUrl } : media })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Video ma’lumotini yuklab bo‘lmadi' }, { status: 500 })
  }
}
