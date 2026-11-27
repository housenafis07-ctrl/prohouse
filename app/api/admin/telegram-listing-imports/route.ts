import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  const status = request.nextUrl.searchParams.get('status') || 'pending'
  const db = serviceClient()
  let query = db.from('telegram_listing_imports')
    .select('id,telegram_user_id,source_text,ai_extracted,status,authorization_status,authorization_method,owner_full_name,owner_phone,authorization_document_path,created_at,submitter_profile_id')
    .not('authorization_document_path', 'is', null)
    .order('created_at', { ascending: true }).limit(100)
  if (status !== 'all') query = query.eq('authorization_status', status)
  const { data, error: listError } = await query
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })
  const rows = await Promise.all((data || []).map(async row => {
    const { data: signed } = await db.storage.from('telegram-listing-imports').createSignedUrl(row.authorization_document_path, 5 * 60)
    return { ...row, documentUrl: signed?.signedUrl || null }
  }))
  return NextResponse.json({ imports: rows }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Unauthorized' ? 401 : 403 })
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const decision = typeof body?.decision === 'string' ? body.decision : ''
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : ''
  if (!id || !['approve','reject'].includes(decision)) return NextResponse.json({ error: 'Import ID va qarorni tekshiring.' }, { status: 400 })
  const db = serviceClient()
  const { data: item, error: lookupError } = await db.from('telegram_listing_imports')
    .select('id,authorization_status,authorization_document_path')
    .eq('id', id).maybeSingle()
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!item || !item.authorization_document_path) return NextResponse.json({ error: 'Hujjatli import topilmadi.' }, { status: 404 })
  if (item.authorization_status === 'verified') return NextResponse.json({ error: 'Vakolat allaqachon tasdiqlangan.' }, { status: 409 })
  const now = new Date().toISOString()
  const approved = decision === 'approve'
  const { data, error: updateError } = await db.from('telegram_listing_imports').update({
    authorization_status: approved ? 'verified' : 'rejected',
    authorization_method: 'admin_review',
    authorized_at: approved ? now : null,
    authorized_by: approved ? admin.user.id : null,
    status: approved ? 'authorized' : 'rejected',
    last_error_code: approved ? null : (note || 'AUTHORIZATION_REJECTED'),
    updated_at: now,
  }).eq('id', id).select('id,authorization_status,status').single()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ ok: true, import: data, message: approved ? 'Vakillik hujjati tasdiqlandi.' : 'Vakillik hujjati rad etildi.' })
}
