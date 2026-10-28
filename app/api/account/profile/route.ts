import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const legalForms = new Set(['self_employed', 'sole_proprietor', 'llc'])
const profileSelect = 'phone,full_name,account_type,partner_type,company_name,inn,bank_name,bank_account,mfo,oked,director_full_name,email,instagram_url,facebook_url,linkedin_url,telegram_url'
const cleanUrl = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

async function getPhoneBackedUserId() {
  const cookieStore = await cookies()
  return readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
}

export async function GET() {
  try {
    const userId = await getPhoneBackedUserId()
    if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const db = serviceClient()
    const { data: profile, error } = await db.from('profiles').select(profileSelect).eq('id', userId).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!profile?.phone) return NextResponse.json({ error: 'PHONE_AUTH_REQUIRED' }, { status: 401 })

    return NextResponse.json({ profile }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'PROFILE_LOAD_FAILED' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const userId = await getPhoneBackedUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
  const accountType = body.account_type === 'partner' ? 'partner' : 'individual'
  const legalForm = typeof body.partner_type === 'string' && legalForms.has(body.partner_type) ? body.partner_type : null
  const companyName = typeof body.company_name === 'string' ? body.company_name.trim() : ''
  const inn = typeof body.inn === 'string' ? body.inn.trim() : ''
  const bankName = typeof body.bank_name === 'string' ? body.bank_name.trim() : ''
  const bankAccount = typeof body.bank_account === 'string' ? body.bank_account.trim() : ''
  const mfo = typeof body.mfo === 'string' ? body.mfo.trim() : ''
  const oked = typeof body.oked === 'string' ? body.oked.trim() : ''
  const directorName = typeof body.director_full_name === 'string' ? body.director_full_name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const instagramUrl = cleanUrl(body.instagram_url)
  const facebookUrl = cleanUrl(body.facebook_url)
  const linkedinUrl = cleanUrl(body.linkedin_url)
  const telegramUrl = cleanUrl(body.telegram_url)

  if (!fullName) return NextResponse.json({ error: 'F.I.O. ni kiriting.' }, { status: 400 })
  if (accountType === 'partner' && !legalForm) return NextResponse.json({ error: 'Hamkor turini tanlang.' }, { status: 400 })
  if (accountType === 'partner' && !inn) return NextResponse.json({ error: 'INN ni kiriting.' }, { status: 400 })
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Email manzilini tekshiring.' }, { status: 400 })

  const db = serviceClient()
  const profilePatch = {
    full_name: fullName,
    account_type: accountType,
    partner_type: accountType === 'partner' ? legalForm : null,
    company_name: companyName || null,
    inn: inn || null,
    bank_name: bankName || null,
    bank_account: bankAccount || null,
    mfo: mfo || null,
    oked: oked || null,
    director_full_name: directorName || null,
    email: email || null,
    instagram_url: instagramUrl,
    facebook_url: facebookUrl,
    linkedin_url: linkedinUrl,
    telegram_url: telegramUrl,
  }
  const { error: updateError } = await db.from('profiles').update(profilePatch).eq('id', userId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  if (accountType === 'partner') {
    const { data: existingPartner, error: existingError } = await db.from('partner_profiles').select('id,verification_status').eq('user_id', userId).maybeSingle()
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 })
    const { error: partnerError } = await db.from('partner_profiles').upsert({
      ...(existingPartner?.id ? { id: existingPartner.id } : {}),
      user_id: userId,
      partner_type: 'service_provider',
      legal_form: legalForm,
      display_name: companyName || fullName,
      company_name: companyName || null,
      verification_status: existingPartner?.verification_status || 'pending',
      metadata: { inn: inn || null, bank_name: bankName || null, bank_account: bankAccount || null, mfo: mfo || null, oked: oked || null, director_full_name: directorName || null },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 400 })
  } else {
    const { error: deleteError } = await db.from('partner_profiles').delete().eq('user_id', userId)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  const { data: updated, error: readError } = await db.from('profiles').select(profileSelect).eq('id', userId).single()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 })
  return NextResponse.json({ profile: updated })
}
