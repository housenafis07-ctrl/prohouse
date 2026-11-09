import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export async function GET() {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })
  const db = serviceClient()
  const { data, error: queryError } = await db.from('developer_complex_documents')
    .select('id,complex_id,developer_id,uploaded_by,document_type,title,document_number,issued_at,expires_at,mime_type,file_size_bytes,moderation_status,moderation_note,requested_visibility_scope,visibility_scope,created_at')
    .eq('moderation_status', 'pending').order('created_at', { ascending: true })
  if (queryError) return NextResponse.json({ error: 'DOCUMENTS_LOAD_FAILED' }, { status: 500 })
  const complexIds = [...new Set((data || []).map(item => item.complex_id))]
  const [{ data: complexes }, { data: developers }] = await Promise.all([
    complexIds.length ? db.from('residential_complexes').select('id,name,city,district').in('id', complexIds) : Promise.resolve({ data: [] }),
    [...new Set((data || []).map(item => item.developer_id))].length
      ? db.from('developer_profiles').select('id,developer_name').in('id', [...new Set((data || []).map(item => item.developer_id))])
      : Promise.resolve({ data: [] }),
  ])
  const complexMap = new Map((complexes || []).map(item => [item.id, item]))
  const developerMap = new Map((developers || []).map(item => [item.id, item]))
  return NextResponse.json({ documents: (data || []).map(item => ({ ...item, complex: complexMap.get(item.complex_id) || null, developer: developerMap.get(item.developer_id) || null })) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })
  const body = await request.json().catch(() => null)
  const id = typeof body?.documentId === 'string' ? body.documentId : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  const visibilityScope = body?.visibilityScope === 'public' ? 'public' : body?.visibilityScope === 'admin_only' ? 'admin_only' : null
  if (!id || !['approved','rejected'].includes(status) || !visibilityScope) return NextResponse.json({ error: 'INVALID_REVIEW_REQUEST' }, { status: 400 })
  if (status === 'rejected' && !note) return NextResponse.json({ error: 'REJECTION_REASON_REQUIRED' }, { status: 400 })
  if (note.length > 2000) return NextResponse.json({ error: 'REVIEW_NOTE_TOO_LONG' }, { status: 400 })
  const db = serviceClient()
  const now = new Date().toISOString()
  const { data, error: updateError } = await db.from('developer_complex_documents').update({
    moderation_status: status, moderation_note: note || null, visibility_scope: status === 'approved' ? visibilityScope : 'admin_only', moderated_by: admin.user.id, moderated_at: now, updated_at: now,
  }).eq('id', id).eq('moderation_status', 'pending').select('id,moderation_status,moderation_note,moderated_at').maybeSingle()
  if (updateError) return NextResponse.json({ error: 'DOCUMENT_REVIEW_FAILED' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'DOCUMENT_NOT_PENDING' }, { status: 409 })
  return NextResponse.json({ document: data }, { headers: { 'Cache-Control': 'no-store' } })
}
