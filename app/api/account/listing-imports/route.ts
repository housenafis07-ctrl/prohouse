import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz'
const normalizePhone = (value: unknown) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`
  if (digits.length === 9) return `+998${digits}`
  return ''
}
async function currentUserId() {
  const store = await cookies()
  return readAccountSession(store.get(ACCOUNT_SESSION_COOKIE)?.value)
}

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const db = serviceClient()
  const { data, error } = await db.from('telegram_listing_imports')
    .select('id,listing_id,ai_extracted,status,authorization_status,authorization_method,owner_full_name,owner_phone,authorization_document_path,created_at,authorized_at')
    .eq('submitter_profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imports: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const db = serviceClient()
  const body = await request.json().catch(() => null)
  const importId = typeof body?.importId === 'string' ? body.importId : ''
  if (!importId) return NextResponse.json({ error: 'IMPORT_ID_REQUIRED' }, { status: 400 })
  if (body?.mode === 'representative_declaration') {
    if (body?.confirmed !== true) return NextResponse.json({ error: 'DECLARATION_REQUIRED', message: 'Davom etish uchun javobgarlik deklaratsiyasini tasdiqlang.' }, { status: 400 })
    const { data: item, error: lookupError } = await db.from('telegram_listing_imports').select('id,authorization_status').eq('id', importId).eq('submitter_profile_id', userId).maybeSingle()
    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
    if (!item) return NextResponse.json({ error: 'IMPORT_NOT_FOUND' }, { status: 404 })
    if (item.authorization_status === 'verified') return NextResponse.json({ error: 'IMPORT_ALREADY_AUTHORIZED' }, { status: 409 })
    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await db.from('telegram_listing_imports').update({
      authorization_method: 'representative_declaration', authorization_status: 'verified',
      authorized_at: now, authorized_by: userId, status: 'authorized',
      last_error_code: null, updated_at: now,
    }).eq('id', importId).eq('submitter_profile_id', userId).eq('authorization_status', 'pending').select('id').maybeSingle()
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    if (!updated) return NextResponse.json({ error: 'IMPORT_AUTHORIZATION_CHANGED' }, { status: 409 })
    return NextResponse.json({ ok: true, message: 'Javobgarlik tasdiqlandi. Endi e’lonni tekshirib, tahrirlashingiz va moderatsiyaga yuborishingiz mumkin.' })
  }
  if (body?.mode !== 'owner_consent') return NextResponse.json({ error: 'INVALID_MODE' }, { status: 400 })
  const ownerName = typeof body.ownerName === 'string' ? body.ownerName.trim() : ''
  const ownerPhone = normalizePhone(body.ownerPhone)
  if (!ownerName || !ownerPhone) return NextResponse.json({ error: 'Mulk egasining F.I.O. va telefon raqamini kiriting.' }, { status: 400 })

  const { data: item, error: lookupError } = await db.from('telegram_listing_imports')
    .select('id,authorization_status')
    .eq('id', importId).eq('submitter_profile_id', userId).maybeSingle()
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!item || item.authorization_status === 'verified') return NextResponse.json({ error: 'Import topilmadi yoki vakolat allaqachon tasdiqlangan.' }, { status: 404 })

  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
  const { error: tokenError } = await db.from('telegram_listing_import_consents').insert({
    import_id: importId, token_hash: tokenHash, owner_phone: ownerPhone, expires_at: expiresAt,
  })
  if (tokenError) return NextResponse.json({ error: tokenError.message }, { status: 500 })
  const { error: updateError } = await db.from('telegram_listing_imports').update({
    owner_full_name: ownerName, owner_phone: ownerPhone, authorization_method: 'owner_sms_otp',
    authorization_status: 'pending', status: 'awaiting_authorization', updated_at: new Date().toISOString(),
  }).eq('id', importId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({
    ok: true,
    consentUrl: `${SITE_URL}/listing-import-consent?token=${encodeURIComponent(rawToken)}`,
    expiresAt,
    message: 'Havolani mulk egasiga yuboring. Egasi o‘z telefon raqami bilan SMS OTP orqali kirib, rozilikni shaxsan tasdiqlashi kerak.',
  }, { headers: { 'Cache-Control': 'no-store' } },)
}
