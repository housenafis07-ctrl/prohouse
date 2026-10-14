import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params
    if (!UUID_RE.test(listingId)) return NextResponse.json({ error: 'INVALID_LISTING_ID' }, { status: 400 })

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const { data: listing, error: listingError } = await db
      .from('listings')
      .select('id')
      .eq('id', listingId)
      .eq('owner_id', user.id)
      .maybeSingle()
    if (listingError) throw listingError
    if (!listing) return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 })

    const mediaId = request.nextUrl.searchParams.get('mediaId') || ''
    if (!UUID_RE.test(mediaId)) return NextResponse.json({ error: 'INVALID_MEDIA_ID' }, { status: 400 })

    const { data: media, error: mediaError } = await db
      .from('listing_media')
      .select('id,provider,processed_storage_path')
      .eq('id', mediaId)
      .eq('listing_id', listingId)
      .single()
    if (mediaError) throw mediaError

    if (media.provider === 'cloudflare' && media.processed_storage_path) {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
      const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN
      if (accountId && apiToken) {
        await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${media.processed_storage_path}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${apiToken}` },
        }).catch(error => console.error('[listing-video/delete] provider delete failed', error))
      }
    }

    const { error: deleteError } = await db
      .from('listing_media')
      .delete()
      .eq('id', mediaId)
      .eq('listing_id', listingId)
    if (deleteError) throw deleteError

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('[listing-video/delete]', error)
    return NextResponse.json({ error: 'VIDEO_DELETE_FAILED' }, { status: 500 })
  }
}
