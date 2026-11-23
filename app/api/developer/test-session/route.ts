import { NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, accountSessionCookieOptions, createAccountSession } from '@/utils/auth/account-session'

// This passwordless entry point is deliberately restricted to Vercel Preview.
// Production and local environments cannot enable it.
function isDeveloperTestModeEnabled() {
  return process.env.VERCEL_ENV === 'preview'
    && process.env.DEVELOPER_TEST_MODE === 'true'
}

export async function POST() {
  if (!isDeveloperTestModeEnabled()) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const userId = process.env.DEVELOPER_TEST_USER_ID
  if (!userId || !/^[0-9a-f-]{20,}$/i.test(userId)) {
    return NextResponse.json({ error: 'DEVELOPER_TEST_ACCOUNT_NOT_CONFIGURED' }, { status: 503 })
  }

  const db = serviceClient()
  const { data: account, error: accountError } = await db
    .from('profiles')
    .select('id,account_type')
    .eq('id', userId)
    .maybeSingle()

  if (accountError) return NextResponse.json({ error: 'ACCOUNT_LOOKUP_FAILED' }, { status: 500 })
  if (!account || account.account_type !== 'partner') {
    return NextResponse.json({ error: 'DEVELOPER_TEST_ACCOUNT_NOT_AUTHORIZED' }, { status: 403 })
  }

  const { data: partner, error: partnerError } = await db
    .from('partner_profiles')
    .select('id,user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (partnerError) return NextResponse.json({ error: 'PARTNER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (!partner || partner.user_id !== userId) {
    return NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 403 })
  }

  const { data: developer, error: developerError } = await db
    .from('developer_profiles')
    .select('id,user_id,partner_profile_id')
    .eq('partner_profile_id', partner.id)
    .maybeSingle()

  if (developerError) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (!developer || (developer.user_id && developer.user_id !== userId)) {
    return NextResponse.json({ error: 'DEVELOPER_PROFILE_REQUIRED' }, { status: 403 })
  }

  const response = NextResponse.json({ ok: true, testMode: true }, {
    headers: { 'Cache-Control': 'no-store' },
  })
  response.cookies.set(
    ACCOUNT_SESSION_COOKIE,
    createAccountSession(userId),
    { ...accountSessionCookieOptions, maxAge: 60 * 60 * 2 },
  )
  return response
}
