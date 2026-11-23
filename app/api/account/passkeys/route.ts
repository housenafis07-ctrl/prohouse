import { NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { currentPasskeyUserId, passkeyErrorResponse } from '@/utils/auth/passkey'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await currentPasskeyUserId()
    if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    const { data, error } = await serviceClient().schema('passkey_stage').from('passkey_credentials')
      .select('credential_id,friendly_name,device_type,backed_up,created_at,last_used_at')
      .eq('user_id', userId).order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ passkeys: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return passkeyErrorResponse(error) }
}

export async function DELETE(request: Request) {
  try {
    const userId = await currentPasskeyUserId()
    if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    const body = await request.json().catch(() => null)
    const credentialId = typeof body?.credentialId === 'string' ? body.credentialId : ''
    if (!credentialId) return NextResponse.json({ error: 'INVALID_CREDENTIAL_ID' }, { status: 400 })
    const db = serviceClient()
    const { data: existing, error: lookupError } = await db.schema('passkey_stage').from('passkey_credentials')
      .select('credential_id').eq('credential_id', credentialId).eq('user_id', userId).maybeSingle()
    if (lookupError) throw lookupError
    if (!existing) return NextResponse.json({ error: 'PASSKEY_NOT_FOUND' }, { status: 404 })
    const { error } = await db.schema('passkey_stage').from('passkey_credentials').delete()
      .eq('credential_id', credentialId).eq('user_id', userId)
    if (error) throw error
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return passkeyErrorResponse(error) }
}
