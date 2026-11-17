import { NextResponse } from 'next/server'
import { currentPasskeyUserId, hasRecentPasskeyAuthentication, passkeyErrorResponse, registrationOptions } from '@/utils/auth/passkey'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const userId = await currentPasskeyUserId()
    if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    if (!(await hasRecentPasskeyAuthentication())) return NextResponse.json({ error: 'PASSKEY_RECENT_AUTH_REQUIRED' }, { status: 403 })
    const options = await registrationOptions(request, userId)
    return NextResponse.json(options, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return passkeyErrorResponse(error) }
}
