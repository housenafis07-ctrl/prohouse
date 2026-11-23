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
    const rawPhone = body?.phone
    const phone = rawPhone ? normalizePhone(rawPhone) : undefined
    if (rawPhone && !phone) return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 })
    if (typeof body?.challenge !== 'string' || !body.challenge || !body?.response?.id) {
      return NextResponse.json({ error: 'INVALID_PASSKEY_REQUEST' }, { status: 400 })
    }

    // The credential ID is globally unique; its stored owner is the account
    // identity for a discoverable, phone-free Passkey assertion.
    const { data: credential, error: credentialError } = await serviceClient()
      .schema('passkey_stage').from('passkey_credentials')
      .select('user_id').eq('credential_id', String(body.response.id)).maybeSingle()
    if (credentialError) throw credentialError
    if (!credential?.user_id) return NextResponse.json({ error: 'PASSKEY_NOT_AVAILABLE' }, { status: 404 })

    if (phone) {
      const { data: profile, error } = await serviceClient().from('profiles').select('id')
        .eq('phone', phone).maybeSingle()
      if (error) throw error
      if (profile?.id !== credential.user_id) return NextResponse.json({ error: 'PASSKEY_NOT_AVAILABLE' }, { status: 404 })
    }

    await verifyPasskeyAuthentication(credential.user_id, phone, body.challenge, body.response, request)
    return await issuePasskeyLoginSession(credential.user_id)
  } catch (error) { return passkeyErrorResponse(error) }
}
