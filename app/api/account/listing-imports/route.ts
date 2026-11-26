import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz'
const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024
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
    .select('id,ai_extracted,status,authorization_status,authorization_method,owner_full_name,owner_phone,authorization_document_path,created_at,authorized_at')
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
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const importId = String(form.get('importId') || '')
    const ownerName = String(form.get('ownerName') || '').trim()
    const ownerPhone = normalizePhone(form.get('ownerPhone'))
    const file = form.get('document')
    if (!importId || !ownerName || !ownerPhone || !(file instanceof File)) {
      return NextResponse.json({ error: 'Import, mulk egasi F.I.O., telefon va hujjatni kiriting.' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) return NextResponse.json({ error: 'Hujjat 12 MB dan kichik bo‘lishi kerak.' }, { status: 400 })
    if (!['application/pdf','image/jpeg','image/png'].includes(file.type)) return NextResponse.json({ error: 'Faqat PDF, JPG yoki PNG hujjat qabul qilinadi.' }, { status: 400 })
    const { data: item, error: lookupError } = await db.from('telegram_listing_imports')
      .select('id,status,authorization_status')
      .eq('id', importId).eq('submitter_profile_id', userId).maybeSingle()
    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
    if (!item || item.authorization_status === 'verified') return NextResponse.json({ error: 'Import topilmadi yoki vakolat allaqachon tasdiqlangan.' }, { status: 404 })
    const path = `authorization/${importId}/${randomBytes(16).toString('hex')}`
    const { error: uploadError } = await db.storage.from('telegram-listing-imports').upload(path, file, {
      contentType: file.type, upsert: false,
    })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
    const { error: updateError } = await db.from('telegram_listing_imports').update({
      owner_full_name: ownerName,
      owner_phone: ownerPhone,
      authorization_document_path: path,
      authorization_method: 'power_of_attorney_review',
      authorization_status: 'pending',
      status: 'awaiting_authorization',
      updated_at: new Date().toISOString(),
    }).eq('id', importId).eq('submitter_profile_id', userId)
    if (updateError) {
      await db.storage.from('telegram-listing-imports').remove([path])
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, message: 'Hujjat admin tekshiruviga yuborildi.' }, { status: 201 })
  }

  const body = await request.json().catch(() => null)
  if (body?.mode !== 'owner_consent') return NextResponse.json({ error: 'INVALID_MODE' }, { status: 400 })
  const importId = typeof body.importId === 'string' ? body.importId : ''
  const ownerName = typeof body.ownerName === 'string' ? body.ownerName.trim() : ''
  const ownerPhone = normalizePhone(body.ownerPhone)
  if (!importId || !ownerName || !ownerPhone) return NextResponse.json({ error: 'Mulk egasining F.I.O. va telefon raqamini kiriting.' }, { status: 400 })

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
