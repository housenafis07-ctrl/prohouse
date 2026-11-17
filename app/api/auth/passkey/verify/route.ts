import { NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { passkeyErrorResponse, verifyPasskeyAuthentication, issuePasskeyLoginSession } from '@/utils/auth/passkey'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.startsWith('998') && digits.length === 12 ? `+${digits}` : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const phone = normalizePhone(body?.phone)
    if (!phone || typeof body?.challenge !== 'string' || !body.challenge || !body?.response) return NextResponse.json({ error: 'INVALID_PASSKEY_REQUEST' }, { status: 400 })
    const { data: profile, error } = await serviceClient().from('profiles').select('id,phone')
      .eq('phone', phone).maybeSingle()
    if (error) throw error
    if (!profile?.id) return NextResponse.json({ error: 'PASSKEY_NOT_AVAILABLE' }, { status: 404 })
    await verifyPasskeyAuthentication(profile.id, phone, body.challenge, body.response)
    return await issuePasskeyLoginSession(profile.id)
  } catch (error) { return passkeyErrorResponse(error) }
}
