import { NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server'
import { serviceClient, getCurrentAdmin } from '@/utils/admin/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SIGNED_URL_TTL = 300

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  const admin = user ? await getCurrentAdmin() : null

  const db = serviceClient()
  const { data: image, error } = await db
    .from('listing_images')
    .select('id,storage_path,listing_id,listings!inner(owner_id,status)')
    .eq('id', id)
    .maybeSingle()

  if (error || !image?.storage_path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const listing = Array.isArray(image.listings) ? image.listings[0] : image.listings
  const isOwner = Boolean(user && listing?.owner_id === user.id)
  const isAdmin = Boolean(admin)
  const isPublicListing = listing?.status === 'active'

  // Anonymous users may only fetch images belonging to active listings.
  // Authenticated users may fetch their own listing images in any workflow state.
  // Admins may fetch images needed for moderation.
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
