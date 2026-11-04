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
  const { data, error } = await db
    .from('developer_profiles')
    .select(safeSelect)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LOAD_FAILED' }, { status: 500 })
  return NextResponse.json({ developer: data }, { headers: { 'Cache-Control': 'no-store' } })
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
    .select(safeSelect)
    .eq('partner_profile_id', partner.id)
    .maybeSingle()

  if (existingError) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (existing) {
    if (existing.user_id && existing.user_id !== userId) {
      return NextResponse.json({ error: 'DEVELOPER_PROFILE_ACCESS_DENIED' }, { status: 403 })
    }
    return NextResponse.json({ developer: existing, alreadyExists: true }, { status: 200 })
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
