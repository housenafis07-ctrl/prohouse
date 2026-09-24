import { NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server'
import { serviceClient, getCurrentAdmin } from '@/utils/admin/auth'

const SIGNED_URL_TTL = 300

export async function GET(request: Request) {
  const url = new URL(request.url)
  const imageUrl = url.searchParams.get('url')
  if (!imageUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  const admin = user ? await getCurrentAdmin() : null

  const db = serviceClient()
  const { data: image, error } = await db
    .from('listing_images')
    .select('id,storage_path,listing_id,listings!inner(owner_id,status)')
    .eq('image_url', imageUrl)
    .maybeSingle()

  if (error || !image?.storage_path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const listing = Array.isArray(image.listings) ? image.listings[0] : image.listings
  const isOwner = Boolean(user && listing?.owner_id === user.id)
  const isAdmin = Boolean(admin)
  const isPublicListing = listing?.status === 'active'

  if (!isPublicListing && !isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: signed, error: signedError } = await db.storage
    .from('listing-images')
    .createSignedUrl(image.storage_path, SIGNED_URL_TTL)

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Image unavailable' }, { status: 404 })
  }

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: {
      'Cache-Control': `private, max-age=${SIGNED_URL_TTL}`,
    },
  })
}
