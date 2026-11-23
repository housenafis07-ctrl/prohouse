import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
    if (!userId) {
      return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const db = serviceClient()
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle()
    if (profileError) throw profileError

    const audience = profile?.account_type === 'partner' ? 'partner' : 'public'
    const { data: offer, error: offerError } = await db
      .from('offer_versions')
      .select('version,title,content,audience')
      .eq('audience', audience)
      .eq('is_active', true)
      .maybeSingle()
    if (offerError) throw offerError
    if (!offer) {
      return NextResponse.json({ error: 'ACTIVE_OFFER_NOT_FOUND' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }

    const { data: consent, error: consentError } = await db
      .from('offer_consents')
      .select('id')
      .eq('user_id', userId)
      .eq('offer_version', offer.version)
      .eq('audience', audience)
      .limit(1)
      .maybeSingle()
    if (consentError) throw consentError

    return NextResponse.json({
      accepted: Boolean(consent),
      offer,
      audience,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('[account-offer-status] lookup failed', error)
    return NextResponse.json({ error: 'OFFER_STATUS_LOOKUP_FAILED' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  }
}
