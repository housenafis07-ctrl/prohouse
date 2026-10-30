import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

function phoneDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

async function getUserId() {
  const store = await cookies()
  return readAccountSession(store.get(ACCOUNT_SESSION_COOKIE)?.value)
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
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

  const body = await request.json().catch(() => null)
  const displayName = typeof body?.display_name === 'string' ? body.display_name.trim() : ''
  const certificate = typeof body?.certificate_number === 'string' ? body.certificate_number.trim() : ''
  const phone = phoneDigits(body?.phone)
  const experience = Number(body?.experience_years ?? 0)
  const agencyName = typeof body?.agency_name === 'string' ? body.agency_name.trim() : ''
  const serviceAreas = Array.isArray(body?.service_areas)
    ? body.service_areas.filter((v: unknown): v is string => typeof v === 'string').map((v: string) => v.trim()).filter(Boolean).slice(0, 20)
    : []

  if (!displayName) return NextResponse.json({ error: 'F.I.O. ni kiriting.' }, { status: 400 })
  if (!certificate) return NextResponse.json({ error: 'Malaka sertifikati raqamini kiriting.' }, { status: 400 })
  if (!phone.startsWith('998') || phone.length !== 12) return NextResponse.json({ error: 'Telefon raqami noto‘g‘ri.' }, { status: 400 })
  if (!Number.isInteger(experience) || experience < 0 || experience > 80) return NextResponse.json({ error: 'Tajriba yilini tekshiring.' }, { status: 400 })

  const db = serviceClient()
  const { data: existing, error: lookupError } = await db.from('realtor_profiles')
    .select('id,verification_status').eq('user_id', userId).maybeSingle()
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (existing) {
    return NextResponse.json({
      error: 'REALTOR_PROFILE_EXISTS',
      message: 'Bu akkaunt uchun rieltor profili allaqachon mavjud.',
      verificationStatus: existing.verification_status,
    }, { status: 409 })
  }

  const { data, error } = await db.from('realtor_profiles').insert({
    user_id: userId,
    display_name: displayName,
    phone: '+' + phone,
    certificate_number: certificate,
    experience_years: experience,
    verification_status: 'pending',
    rating: 0,
    reviews_count: 0,
    agency_id: null,
    agency_name: agencyName || null,
    service_areas: serviceAreas,
    bio: 'Royalhouse rieltorlik kabineti orqali yuborilgan ariza.',
  }).select('id,verification_status').single()

  if (error) {
    // Convert database errors into safe, actionable user-facing messages.
    if (error.code === '23505') return NextResponse.json({ error: 'REALTOR_PROFILE_EXISTS', message: 'Bu akkaunt uchun ariza avval yuborilgan.' }, { status: 409 })
    return NextResponse.json({ error: 'REALTOR_APPLICATION_FAILED', message: error.message, code: error.code || null }, { status: 400 })
  }
  return NextResponse.json({ ok: true, realtor: data }, { status: 201 })
}
