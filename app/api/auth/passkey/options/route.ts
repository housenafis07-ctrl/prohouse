import { NextResponse } from 'next/server'
import { authenticationOptions, passkeyErrorResponse } from '@/utils/auth/passkey'

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
    const options = await authenticationOptions(request, phone)
    return NextResponse.json(options, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return passkeyErrorResponse(error) }
}
