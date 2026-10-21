import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const REVIEW_STATUSES = new Set(['under_review', 'verified', 'rejected'])

export async function GET() {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })

  const db = serviceClient()
  const { data, error: queryError } = await db
    .from('partner_profiles')
    .select('id,user_id,partner_type,legal_form,display_name,company_name,verification_status,trusted_partner_status,trusted_partner_rejection_reason,trusted_partner_reviewed_at,updated_at,profiles!inner(full_name,phone,inn,company_name)')
    .in('trusted_partner_status', ['requested', 'under_review', 'verified', 'rejected'])
    .order('updated_at', { ascending: false })
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 })

  const rows = data || []
  const userIds = rows.map(row => row.user_id).filter(Boolean)
  const { data: documents, error: documentError } = userIds.length
    ? await db.from('partner_verification_documents')
      .select('id,user_id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,storage_path,created_at,reviewed_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
    : { data: [], error: null }
  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })

  const documentRows = await Promise.all((documents || []).map(async document => {
    const { data: signed } = await db.storage.from('partner-verification-documents').createSignedUrl(document.storage_path, 900)
    return { ...document, signed_url: signed?.signedUrl || null }
  }))

  return NextResponse.json({ partners: rows, documents: documentRows })
}

export async function PATCH(request: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })

  const body = await request.json().catch(() => null)
  const partnerProfileId = typeof body?.partnerProfileId === 'string' ? body.partnerProfileId : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  const rejectionReason = typeof body?.rejectionReason === 'string' ? body.rejectionReason.trim() : ''
  if (!partnerProfileId || !REVIEW_STATUSES.has(status)) return NextResponse.json({ error: 'INVALID_REVIEW' }, { status: 400 })
  if (status === 'rejected' && !rejectionReason) return NextResponse.json({ error: 'REJECTION_REASON_REQUIRED' }, { status: 400 })

  const db = serviceClient()
  const { data: partner, error: partnerError } = await db
    .from('partner_profiles')
    .select('id,user_id')
    .eq('id', partnerProfileId)
    .maybeSingle()
  if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 500 })
  if (!partner) return NextResponse.json({ error: 'PARTNER_NOT_FOUND' }, { status: 404 })

  const now = new Date().toISOString()
  const { error: updateError } = await db
    .from('partner_profiles')
    .update({
      trusted_partner_status: status,
      trusted_partner_rejection_reason: status === 'rejected' ? rejectionReason : null,
      trusted_partner_reviewed_at: now,
      trusted_partner_reviewed_by: admin.user.id,
      updated_at: now,
    })
    .eq('id', partnerProfileId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  if (status === 'verified') {
    await db.from('partner_verification_documents')
      .update({ status: 'accepted', reviewed_at: now, reviewed_by: admin.user.id, updated_at: now })
      .eq('user_id', partner.user_id)
      .eq('status', 'submitted')
  }
  if (status === 'rejected') {
    await db.from('partner_verification_documents')
      .update({ status: 'rejected', rejection_reason: rejectionReason, reviewed_at: now, reviewed_by: admin.user.id, updated_at: now })
      .eq('user_id', partner.user_id)
      .eq('status', 'submitted')
  }

  return NextResponse.json({ ok: true, status })
}
