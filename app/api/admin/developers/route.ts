import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const REVIEW_STATUSES = new Set(['pending', 'verified', 'rejected'])

export async function GET() {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })

  const db = serviceClient()
  const { data, error: queryError } = await db
    .from('developer_profiles')
    .select('id,partner_profile_id,user_id,developer_name,description,website,phone,verification_status,metadata,created_at,updated_at,partner_profiles!inner(id,user_id,display_name,company_name,partner_type)')
    .order('created_at', { ascending: false })
  if (queryError) return NextResponse.json({ error: 'DEVELOPER_APPLICATIONS_LOAD_FAILED' }, { status: 500 })

  const rows = data || []
  const userIds = [...new Set(rows.map(row => row.user_id || row.partner_profiles?.user_id).filter(Boolean))]
  const { data: profiles, error: profilesError } = userIds.length
    ? await db.from('profiles').select('id,full_name,phone,account_type,company_name,inn').in('id', userIds)
    : { data: [], error: null }
  if (profilesError) return NextResponse.json({ error: 'DEVELOPER_APPLICANTS_LOAD_FAILED' }, { status: 500 })
  const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]))

  return NextResponse.json({
    applications: rows.map(row => ({
      ...row,
      applicant: profileMap.get(row.user_id || row.partner_profiles?.user_id) || null,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })

  const body = await request.json().catch(() => null)
  const id = typeof body?.developerProfileId === 'string' ? body.developerProfileId : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  const rejectionReason = typeof body?.rejectionReason === 'string' ? body.rejectionReason.trim() : ''
  if (!id) return NextResponse.json({ error: 'DEVELOPER_PROFILE_ID_REQUIRED' }, { status: 400 })
  if (!REVIEW_STATUSES.has(status)) return NextResponse.json({ error: 'INVALID_REVIEW_STATUS' }, { status: 400 })
  if (status === 'rejected' && !rejectionReason) return NextResponse.json({ error: 'REJECTION_REASON_REQUIRED' }, { status: 400 })
  if (rejectionReason.length > 1000) return NextResponse.json({ error: 'REJECTION_REASON_TOO_LONG' }, { status: 400 })

  const db = serviceClient()
  const { data: existing, error: lookupError } = await db
    .from('developer_profiles')
    .select('id,metadata')
    .eq('id', id)
    .maybeSingle()
  if (lookupError) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'DEVELOPER_PROFILE_NOT_FOUND' }, { status: 404 })

  const now = new Date().toISOString()
  const metadata = existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata) ? existing.metadata : {}
  const { error: updateError } = await db.from('developer_profiles').update({
    verification_status: status,
    metadata: {
      ...metadata,
      admin_review: {
        status,
        reason: status === 'rejected' ? rejectionReason : null,
        reviewed_at: now,
        reviewed_by: admin.user.id,
      },
      },
    updated_at: now,
  }).eq('id', id)
  if (updateError) return NextResponse.json({ error: 'DEVELOPER_APPLICATION_REVIEW_FAILED' }, { status: 500 })

  return NextResponse.json({ ok: true, status, reviewedAt: now }, { headers: { 'Cache-Control': 'no-store' } })
}
