import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const REVIEW_STATUSES = new Set(['verified', 'rejected'])

export async function GET() {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })

  const db = serviceClient()
  const { data, error: queryError } = await db
    .from('realtor_profiles')
    .select('id,user_id,display_name,phone,certificate_number,experience_years,agency_name,service_areas,verification_status,verification_rejection_reason,verification_reviewed_at,created_at')
    .order('created_at', { ascending: false })

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 })
  return NextResponse.json({ realtors: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })

  const body = await request.json().catch(() => null)
  const realtorProfileId = typeof body?.realtorProfileId === 'string' ? body.realtorProfileId : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  const rejectionReason = typeof body?.rejectionReason === 'string' ? body.rejectionReason.trim().slice(0, 1000) : ''

  if (!realtorProfileId) return NextResponse.json({ error: 'REALTOR_PROFILE_ID_REQUIRED' }, { status: 400 })
  if (!REVIEW_STATUSES.has(status)) return NextResponse.json({ error: 'INVALID_REVIEW_STATUS' }, { status: 400 })
  if (status === 'rejected' && !rejectionReason) return NextResponse.json({ error: 'REJECTION_REASON_REQUIRED' }, { status: 400 })

  const db = serviceClient()
  const { data: realtor, error: lookupError } = await db
    .from('realtor_profiles')
    .select('id,verification_status')
    .eq('id', realtorProfileId)
    .maybeSingle()

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!realtor) return NextResponse.json({ error: 'REALTOR_NOT_FOUND' }, { status: 404 })
  if (realtor.verification_status !== 'pending' && realtor.verification_status !== 'verified' && realtor.verification_status !== 'rejected') {
    return NextResponse.json({ error: 'INVALID_CURRENT_STATUS' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const { error: updateError } = await db
    .from('realtor_profiles')
    .update({
      verification_status: status,
      verification_rejection_reason: status === 'rejected' ? rejectionReason : null,
      verification_reviewed_at: now,
      verification_reviewed_by: admin.user.id,
      updated_at: now,
    })
    .eq('id', realtorProfileId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ ok: true, status, reviewedAt: now })
}
