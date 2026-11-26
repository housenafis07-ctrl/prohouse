import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '').replace(/^998/, '998')
const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex')

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || ''
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ error: 'CONSENT_LINK_INVALID' }, { status: 400 })
  const db = serviceClient()
  const { data, error } = await db.from('telegram_listing_import_consents')
    .select('id,import_id,owner_phone,expires_at,consumed_at,telegram_listing_imports!inner(ai_extracted,owner_full_name,status)')
    .eq('token_hash', tokenHash(token)).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.consumed_at || new Date(data.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'CONSENT_LINK_EXPIRED_OR_USED' }, { status: 410 })
  }
  const listing = Array.isArray(data.telegram_listing_imports) ? data.telegram_listing_imports[0] : data.telegram_listing_imports
  const extracted = listing?.ai_extracted || {}
  return NextResponse.json({
    valid: true,
    ownerName: listing?.owner_full_name || null,
    phoneHint: String(data.owner_phone).replace(/^(\+998\d{2})\d{4}(\d{3})$/, '$1••••$2'),
    listing: { title: extracted.title || 'Ko‘chmas mulk e’loni', city: extracted.city || '', district: extracted.district || '', price: extracted.price ?? null, currency: extracted.currency || '' },
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const store = await cookies()
  const userId = readAccountSession(store.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ error: 'CONSENT_LINK_INVALID' }, { status: 400 })
  const db = serviceClient()
  const [{ data: profile, error: profileError }, { data: consent, error: consentError }] = await Promise.all([
    db.from('profiles').select('id,phone,full_name').eq('id', userId).maybeSingle(),
    db.from('telegram_listing_import_consents').select('id,import_id,owner_phone,expires_at,consumed_at')
      .eq('token_hash', tokenHash(token)).maybeSingle(),
  ])
  if (profileError || consentError) return NextResponse.json({ error: profileError?.message || consentError?.message }, { status: 500 })
  if (!profile?.phone || !consent || consent.consumed_at || new Date(consent.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'CONSENT_LINK_EXPIRED_OR_USED' }, { status: 410 })
  }
  if (normalizePhone(profile.phone) !== normalizePhone(consent.owner_phone)) {
    return NextResponse.json({ error: 'OWNER_PHONE_MISMATCH', message: 'SMS OTP orqali kirgan akkaunt telefon raqami mulk egasi sifatida ko‘rsatilgan raqamga mos emas.' }, { status: 403 })
  }
  const now = new Date().toISOString()
  const { data: consumed, error: consumeError } = await db.from('telegram_listing_import_consents')
    .update({ consumed_at: now }).eq('id', consent.id).is('consumed_at', null).gt('expires_at', now).select('id').maybeSingle()
  if (consumeError) return NextResponse.json({ error: consumeError.message }, { status: 500 })
  if (!consumed) return NextResponse.json({ error: 'CONSENT_LINK_ALREADY_USED' }, { status: 409 })
  const { error: updateError } = await db.from('telegram_listing_imports').update({
    authorization_status: 'verified', authorization_method: 'owner_sms_otp',
    authorized_at: now, authorized_by: userId, status: 'ready_for_moderation',
    updated_at: now,
  }).eq('id', consent.import_id).eq('authorization_status', 'pending')
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ ok: true, message: 'Mulk egasi roziligi SMS OTP orqali tasdiqlandi. E’lon keyingi bosqichda moderatsiyaga tayyorlanadi.' })
}
