import { NextResponse } from 'next/server'
import { currentPasskeyUserId, passkeyErrorResponse, verifyPasskeyRegistration } from '@/utils/auth/passkey'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const userId = await currentPasskeyUserId()
    if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    const body = await request.json()
    if (!body?.response || typeof body.response !== 'object') return NextResponse.json({ error: 'INVALID_PASSKEY_RESPONSE' }, { status: 400 })
    const result = await verifyPasskeyRegistration(request, userId, body.response, body.friendlyName)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return passkeyErrorResponse(error) }
}
