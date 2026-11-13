import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const safeSelect = 'id,developer_name,description,logo_url,website,phone,verification_status,created_at'

async function getSignedUserId() {
  const cookieStore = await cookies()
  return readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
}

export async function GET() {
  const userId = await getSignedUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const db = serviceClient()
  const { data: partner, error: partnerError } = await db
    .from('partner_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (partnerError) return NextResponse.json({ error: 'PARTNER_PROFILE_LOOKUP_FAILED' }, { status: 500 })

  const query = db.from('developer_profiles').select(`${safeSelect},metadata`)
  let data: any = null
  let role = 'owner'
  let error: any = null
  if (partner) {
    const result = await query.eq('partner_profile_id', partner.id).maybeSingle()
    data = result.data; error = result.error
  }
  if (error) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LOAD_FAILED' }, { status: 500 })
  if (data?.user_id && data.user_id !== userId) data = null

  if (!data) {
    const { data: memberships, error: membershipError } = await db.from('developer_team_members')
      .select('developer_id,role').eq('user_id', userId).eq('status', 'active').limit(2)
    if (membershipError) return NextResponse.json({ error: 'TEAM_MEMBERSHIP_LOOKUP_FAILED' }, { status: 500 })
    if ((memberships || []).length > 1) return NextResponse.json({ error: 'DEVELOPER_COMPANY_SELECTION_REQUIRED' }, { status: 409 })
    const membership = memberships?.[0]
    if (membership) {
      const result = await db.from('developer_profiles').select(`${safeSelect},metadata`)
        .eq('id', membership.developer_id).eq('verification_status', 'verified').maybeSingle()
      data = result.data; error = result.error; role = membership.role
    }
  }

  if (error) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LOAD_FAILED' }, { status: 500 })
  const metadata = data?.metadata && typeof data.metadata === 'object' ? data.metadata as Record<string, any> : {}
  const adminReview = metadata.admin_review
  const publicReview = adminReview ? { status: adminReview.status, reason: adminReview.reason || null, reviewed_at: adminReview.reviewed_at || null } : null
  const developer = data ? { ...data, role, company_details: metadata.company_details || {}, metadata: publicReview ? { admin_review: publicReview } : null } : null
  return NextResponse.json({ developer }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const userId = await getSignedUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const developerName = typeof body.developer_name === 'string' ? body.developer_name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const website = typeof body.website === 'string' ? body.website.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''

  if (developerName.length < 2 || developerName.length > 160) {
    return NextResponse.json({ error: 'COMPANY_NAME_INVALID' }, { status: 400 })
  }
  if (description.length > 4000 || website.length > 240 || phone.length > 40) {
    return NextResponse.json({ error: 'FIELD_TOO_LONG' }, { status: 400 })
  }
  if (website && !/^https?:\/\//i.test(website)) {
    return NextResponse.json({ error: 'WEBSITE_MUST_INCLUDE_PROTOCOL' }, { status: 400 })
  }

  const db = serviceClient()
  const { data: account, error: accountError } = await db
    .from('profiles')
    .select('id,account_type,company_name,phone')
    .eq('id', userId)
    .maybeSingle()

  if (accountError) return NextResponse.json({ error: 'ACCOUNT_LOOKUP_FAILED' }, { status: 500 })
  if (!account || account.account_type !== 'partner') {
    return NextResponse.json({ error: 'PARTNER_ACCOUNT_REQUIRED' }, { status: 403 })
  }

  const { data: partner, error: partnerError } = await db
    .from('partner_profiles')
    .select('id,user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (partnerError) return NextResponse.json({ error: 'PARTNER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (!partner) return NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 403 })

  const { data: existing, error: existingError } = await db
    .from('developer_profiles')
    .select('id,user_id')
    .eq('partner_profile_id', partner.id)
    .maybeSingle()

  if (existingError) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (existing) {
    // partner_profile_id is unique and was resolved through the signed-in user's own partner profile.
    if (existing.user_id && existing.user_id !== userId) {
      return NextResponse.json({ error: 'DEVELOPER_PROFILE_ACCESS_DENIED' }, { status: 403 })
    }
    if (!existing.user_id) {
      const { error: linkError } = await db.from('developer_profiles')
        .update({ user_id: userId })
        .eq('id', existing.id)
      if (linkError) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LINK_FAILED' }, { status: 500 })
    }
    return NextResponse.json({ developer: { id: existing.id }, alreadyExists: true }, { status: 200 })
  }

  const { data: developer, error: insertError } = await db
    .from('developer_profiles')
    .insert({
      partner_profile_id: partner.id,
      user_id: userId,
      developer_name: developerName,
      description: description || null,
      website: website || null,
      phone: phone || account.phone || null,
      verification_status: 'pending',
    })
    .select(safeSelect)
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'DEVELOPER_APPLICATION_ALREADY_EXISTS' }, { status: 409 })
    }
    return NextResponse.json({ error: 'DEVELOPER_APPLICATION_CREATE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ developer }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: Request) {
  const userId = await getSignedUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })

  const developerName = typeof body.developer_name === 'string' ? body.developer_name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const website = typeof body.website === 'string' ? body.website.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  if (developerName.length < 2 || developerName.length > 160) {
    return NextResponse.json({ error: 'COMPANY_NAME_INVALID' }, { status: 400 })
  }
  if (description.length > 4000 || website.length > 240 || phone.length > 40) {
    return NextResponse.json({ error: 'FIELD_TOO_LONG' }, { status: 400 })
  }
  if (website && !/^https?:\/\//i.test(website)) {
    return NextResponse.json({ error: 'WEBSITE_MUST_INCLUDE_PROTOCOL' }, { status: 400 })
  }

  const companyDetails = {
    tax_id: typeof body.tax_id === 'string' ? body.tax_id.trim() : '',
    legal_address: typeof body.legal_address === 'string' ? body.legal_address.trim() : '',
    contact_email: typeof body.contact_email === 'string' ? body.contact_email.trim().toLowerCase() : '',
    responsible_name: typeof body.responsible_name === 'string' ? body.responsible_name.trim() : '',
    responsible_position: typeof body.responsible_position === 'string' ? body.responsible_position.trim() : '',
    registration_date: typeof body.registration_date === 'string' ? body.registration_date.trim() : '',
  }
  if (companyDetails.tax_id && !/^\d{9}$/.test(companyDetails.tax_id)) return NextResponse.json({ error: 'TAX_ID_INVALID' }, { status: 400 })
  if (companyDetails.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyDetails.contact_email)) return NextResponse.json({ error: 'CONTACT_EMAIL_INVALID' }, { status: 400 })
  if (Object.values(companyDetails).some(value => value.length > 240)) return NextResponse.json({ error: 'FIELD_TOO_LONG' }, { status: 400 })
  if (companyDetails.registration_date && !/^\d{4}-\d{2}-\d{2}$/.test(companyDetails.registration_date)) return NextResponse.json({ error: 'REGISTRATION_DATE_INVALID' }, { status: 400 })

  const db = serviceClient()
  const { data: partner, error: partnerError } = await db.from('partner_profiles')
    .select('id').eq('user_id', userId).maybeSingle()
  if (partnerError) return NextResponse.json({ error: 'PARTNER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (!partner) return NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 403 })

  const { data: existing, error: existingError } = await db.from('developer_profiles')
    .select('id,user_id').eq('partner_profile_id', partner.id).maybeSingle()
  if (existingError) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'DEVELOPER_PROFILE_REQUIRED' }, { status: 404 })
  if (existing.user_id && existing.user_id !== userId) {
    return NextResponse.json({ error: 'DEVELOPER_PROFILE_ACCESS_DENIED' }, { status: 403 })
  }

  const { data: current, error: currentError } = await db.from('developer_profiles').select('metadata').eq('id', existing.id).single()
  if (currentError) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LOAD_FAILED' }, { status: 500 })
  const currentMetadata = current?.metadata && typeof current.metadata === 'object' ? current.metadata as Record<string, any> : {}
  const nextMetadata = { ...currentMetadata, company_details: companyDetails }
  const { data, error } = await db.from('developer_profiles').update({
    user_id: existing.user_id || userId,
    developer_name: developerName,
    description: description || null,
    website: website || null,
    phone: phone || null,
    metadata: nextMetadata,
  }).eq('id', existing.id).select(safeSelect).single()
  if (error) return NextResponse.json({ error: 'DEVELOPER_PROFILE_UPDATE_FAILED' }, { status: 500 })
  return NextResponse.json({ developer: { ...data, company_details: companyDetails } }, { headers: { 'Cache-Control': 'no-store' } })
}
