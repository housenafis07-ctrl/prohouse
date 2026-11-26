import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

async function currentUserId() {
  const store = await cookies()
  return readAccountSession(store.get(ACCOUNT_SESSION_COOKIE)?.value)
}
type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const { id } = await context.params
  const db = serviceClient()
  const { data: item, error } = await db.from('telegram_listing_imports')
    .select('id,submitter_profile_id,authorized_by,ai_extracted,source_media,authorization_status,authorization_method,status,owner_full_name,owner_phone,created_at')
    .eq('id', id).eq('submitter_profile_id', userId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!item) return NextResponse.json({ error: 'IMPORT_NOT_FOUND' }, { status: 404 })
  if (item.authorization_status !== 'verified' || item.status !== 'authorized') {
    return NextResponse.json({ error: 'IMPORT_NOT_AUTHORIZED', message: 'Avval mulk egasi roziligi yoki vakillik hujjati tasdiqlanishi kerak.' }, { status: 403 })
  }
  const media = Array.isArray(item.source_media) ? item.source_media : []
  const images = await Promise.all(media.map(async (file: { path?: string; content_type?: string; size_bytes?: number }) => {
    if (!file.path) return null
    const { data, error: signedError } = await db.storage.from('telegram-listing-imports').createSignedUrl(file.path, 10 * 60)
    if (signedError || !data?.signedUrl) return null
    return { url: data.signedUrl, contentType: file.content_type || 'image/jpeg', sizeBytes: file.size_bytes || 0 }
  }))
  return NextResponse.json({
    import: {
      id: item.id,
      aiExtracted: item.ai_extracted || {},
      authorizationMethod: item.authorization_method,
      submitterIsOwner: item.authorized_by === item.submitter_profile_id,
      ownerName: item.owner_full_name,
      ownerPhone: item.owner_phone,
      images: images.filter(Boolean),
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request, context: Context) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const { id } = await context.params
  const body = await request.json().catch(() => null)
  const listingId = typeof body?.listingId === 'string' ? body.listingId : ''
  if (!listingId) return NextResponse.json({ error: 'LISTING_ID_REQUIRED' }, { status: 400 })
  const db = serviceClient()
  const [{ data: item, error: importError }, { data: listing, error: listingError }] = await Promise.all([
    db.from('telegram_listing_imports').select('id,listing_id,authorization_status,status')
      .eq('id', id).eq('submitter_profile_id', userId).maybeSingle(),
    db.from('listings').select('id,status').eq('id', listingId).eq('owner_id', userId).maybeSingle(),
  ])
  if (importError || listingError) return NextResponse.json({ error: importError?.message || listingError?.message }, { status: 500 })
  if (!item || item.authorization_status !== 'verified') return NextResponse.json({ error: 'IMPORT_NOT_AUTHORIZED' }, { status: 403 })
  if (!listing || listing.status !== 'moderation') return NextResponse.json({ error: 'LISTING_NOT_IN_MODERATION' }, { status: 409 })
  if (item.listing_id && item.listing_id !== listingId) return NextResponse.json({ error: 'IMPORT_ALREADY_LINKED' }, { status: 409 })
  const { error: updateError } = await db.from('telegram_listing_imports').update({
    listing_id: listingId,
    status: 'ready_for_moderation',
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('authorization_status', 'verified')
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
