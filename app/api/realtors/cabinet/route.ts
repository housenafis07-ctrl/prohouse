import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const HANDOFF_COOKIE = 'rh_realtor_handoff'
const HANDOFF_TTL_SECONDS = 90

function signHandoff(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function createHandoff(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + HANDOFF_TTL_SECONDS })).toString('base64url')
  return `${payload}.${signHandoff(payload)}`
}

function verifyHandoff(token: string | undefined, userId: string) {
  if (!token) return false
  const separator = token.lastIndexOf('.')
  if (separator <= 0) return false
  const payload = token.slice(0, separator)
  const received = Buffer.from(token.slice(separator + 1))
  const expected = Buffer.from(signHandoff(payload))
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return data.userId === userId && Number.isFinite(data.exp) && data.exp > Math.floor(Date.now() / 1000)
  } catch { return false }
}

function phoneDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

async function getUserId() {
  const store = await cookies()
  return readAccountSession(store.get(ACCOUNT_SESSION_COOKIE)?.value)
}

export async function GET(request: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  // A verified main-account handoff is the ONLY way to skip the realtor SMS
  // screen. A normal account cookie alone must never authorize this shortcut.
  const url = new URL(request.url)
  if (url.searchParams.get('handoff') === 'consume') {
    const store = await cookies()
    const token = store.get(HANDOFF_COOKIE)?.value
    const valid = verifyHandoff(token, userId)
    const response = NextResponse.json({ authorized: false }, { headers: { 'Cache-Control': 'no-store' } })
    response.cookies.set(HANDOFF_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/realtors/cabinet',
      maxAge: 0,
    })
    if (!valid) return response

    const db = serviceClient()
    const [{ data: profile }, { data: realtor }] = await Promise.all([
      db.from('profiles').select('phone').eq('id', userId).maybeSingle(),
      db.from('realtor_profiles').select('id,verification_status,certificate_document_path').eq('user_id', userId).maybeSingle(),
    ])
    const authorizedResponse = NextResponse.json({
      authorized: true,
      phone: profile?.phone || null,
      hasRealtorProfile: Boolean(realtor),
      verificationStatus: realtor?.verification_status || null,
    }, { headers: { 'Cache-Control': 'no-store' } })
    authorizedResponse.cookies.set(HANDOFF_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/realtors/cabinet',
      maxAge: 0,
    })
    return authorizedResponse
  }

  const db = serviceClient()
  const { data, error } = await db.from('realtor_profiles')
    .select('id,verification_status,display_name,certificate_number,phone,experience_years,rating,reviews_count,agency_name,service_areas,bio,avatar_url')
    .eq('user_id', userId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: profile } = await db.from('profiles').select('phone,full_name,account_type,company_name').eq('id', userId).maybeSingle()
  const now = new Date().toISOString()
  const { data: activeBenefit, error: benefitError } = await db.from('realtor_admin_benefit_grants')
    .select('id,benefit_tier,listing_limit,features,starts_at,ends_at,note')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .lte('starts_at', now)
    .gt('ends_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (benefitError) return NextResponse.json({ error: benefitError.message }, { status: 500 })
  return NextResponse.json({ userId, phone: profile?.phone || null, profile: profile || null, realtor: data || null, activeBenefit: activeBenefit || null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED', message: 'Sessiya topilmadi. SMS orqali qayta tasdiqlang.' }, { status: 401 })

  const isMultipart = (request.headers.get('content-type') || '').includes('multipart/form-data')
  const form = isMultipart ? await request.formData() : null
  const body = form ? Object.fromEntries(form.entries()) : await request.json().catch(() => null)
  const certificateFile = form?.get('certificate_document') instanceof File ? form.get('certificate_document') as File : null

  // Create a short-lived, signed, account-bound handoff from the main cabinet.
  if (body?.intent === 'handoff') {
    const response = NextResponse.json({ ok: true })
    response.cookies.set(HANDOFF_COOKIE, createHandoff(userId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/realtors/cabinet',
      maxAge: HANDOFF_TTL_SECONDS,
    })
    return response
  }

  const displayName = typeof body?.display_name === 'string' ? body.display_name.trim() : ''
  const certificate = typeof body?.certificate_number === 'string' ? body.certificate_number.trim() : ''
  const phone = phoneDigits(body?.phone)
  const experience = Number(body?.experience_years ?? 0)
  const agencyName = typeof body?.agency_name === 'string' ? body.agency_name.trim() : ''
  let rawServiceAreas: unknown = body?.service_areas
  if (typeof rawServiceAreas === 'string') { try { rawServiceAreas = JSON.parse(rawServiceAreas) } catch { rawServiceAreas = [] } }
  const serviceAreas = Array.isArray(rawServiceAreas)
    ? rawServiceAreas.filter((v: unknown): v is string => typeof v === 'string').map((v: string) => v.trim()).filter(Boolean).slice(0, 20)
    : []

  if (!displayName) return NextResponse.json({ error: 'F.I.O. ni kiriting.' }, { status: 400 })
  if (!certificate) return NextResponse.json({ error: 'Malaka sertifikati raqamini kiriting.' }, { status: 400 })
  if (!certificateFile) return NextResponse.json({ error: 'Malaka sertifikati yoki rieltorlik vakolat hujjatini PDF, JPG yoki PNG formatida yuklang.' }, { status: 400 })
  if (certificateFile.size <= 0 || certificateFile.size > 12 * 1024 * 1024) return NextResponse.json({ error: 'Hujjat 12 MB dan kichik bo‘lishi kerak.' }, { status: 400 })
  if (!['application/pdf','image/jpeg','image/png'].includes(certificateFile.type)) return NextResponse.json({ error: 'Faqat PDF, JPG yoki PNG hujjat qabul qilinadi.' }, { status: 400 })
  if (!phone.startsWith('998') || phone.length !== 12) return NextResponse.json({ error: 'Telefon raqami noto‘g‘ri.' }, { status: 400 })
  if (!Number.isInteger(experience) || experience < 0 || experience > 80) return NextResponse.json({ error: 'Tajriba yilini tekshiring.' }, { status: 400 })

  const db = serviceClient()
  const { data: existing, error: lookupError } = await db.from('realtor_profiles')
    .select('id,verification_status,certificate_document_path').eq('user_id', userId).maybeSingle()
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (existing?.verification_status === 'verified') {
    return NextResponse.json({
      error: 'REALTOR_PROFILE_EXISTS',
      message: 'Bu akkaunt uchun rieltor profili allaqachon tasdiqlangan.',
      verificationStatus: existing.verification_status,
    }, { status: 409 })
  }

  const documentPath = `${userId}/realtor-certificate/${Date.now()}-${randomBytes(12).toString('hex')}`
  const { error: uploadError } = await db.storage.from('partner-verification-documents').upload(documentPath, certificateFile, {
    contentType: certificateFile.type, upsert: false,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const applicationFields = {
    display_name: displayName,
    phone: '+' + phone,
    certificate_number: certificate,
    certificate_document_path: documentPath,
    experience_years: experience,
    verification_status: 'pending',
    verification_rejection_reason: null,
    rating: existing ? undefined : 0,
    reviews_count: existing ? undefined : 0,
    agency_id: null,
    agency_name: agencyName || null,
    service_areas: serviceAreas,
    bio: 'Royalhouse rieltorlik kabineti orqali yuborilgan ariza.',
  }
  const { data, error } = existing
    ? await db.from('realtor_profiles').update(applicationFields).eq('id', existing.id).select('id,verification_status').single()
    : await db.from('realtor_profiles').insert({ user_id: userId, ...applicationFields }).select('id,verification_status').single()

  if (error) {
    await db.storage.from('partner-verification-documents').remove([documentPath])
    if (error.code === '23505') return NextResponse.json({ error: 'REALTOR_PROFILE_EXISTS', message: 'Bu akkaunt uchun ariza avval yuborilgan.' }, { status: 409 })
    return NextResponse.json({ error: 'REALTOR_APPLICATION_FAILED', message: error.message, code: error.code || null }, { status: 400 })
  }
  if (existing?.certificate_document_path) await db.storage.from('partner-verification-documents').remove([existing.certificate_document_path])
  return NextResponse.json({ ok: true, realtor: data, updated: Boolean(existing) }, { status: existing ? 200 : 201 })
}
