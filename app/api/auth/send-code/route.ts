import { NextResponse } from 'next/server'
import { createHash, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const ESKIZ_BASE_URL = 'https://notify.eskiz.uz'
const OTP_TTL_SECONDS = 5 * 60
const RESEND_COOLDOWN_SECONDS = 60

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('8') && digits.length === 9) return `+998${digits.slice(1)}`
  return ''
}

function hashOtp(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server kaliti sozlanmagan.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function eskizLogin() {
  const email = process.env.ESKIZ_EMAIL
  const password = process.env.ESKIZ_PASSWORD
  if (!email || !password) throw new Error('ESKIZ_EMAIL yoki ESKIZ_PASSWORD sozlanmagan.')

  const body = new FormData()
  body.append('email', email)
  body.append('password', password)

  const response = await fetch(`${ESKIZ_BASE_URL}/api/auth/login`, {
    method: 'POST',
    body,
    cache: 'no-store',
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.data?.token) {
    throw new Error(data?.message || data?.error || `Eskiz login xatosi (${response.status}).`)
  }
  return data.data.token as string
}

async function sendEskizSms(phone: string, message: string) {
  const from = process.env.ESKIZ_FROM || '4546'
  let token = await eskizLogin()

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const body = new FormData()
    body.append('mobile_phone', phone.replace('+', ''))
    body.append('message', message)
    body.append('from', from)

    const response = await fetch(`${ESKIZ_BASE_URL}/api/message/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
      cache: 'no-store',
    })

    const data = await response.json().catch(() => null)
    if (response.ok) return data

    if (response.status === 401 && attempt === 0) {
      token = await eskizLogin()
      continue
    }

    throw new Error(data?.message || data?.error || `Eskiz SMS xatosi (${response.status}).`)
  }

  throw new Error('Eskiz SMS yuborilmadi.')
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('test') !== 'eskiz_login') {
    return NextResponse.json({ ok: true, service: 'sms' })
  }

  const started = Date.now()
  try {
    const token = await eskizLogin()
    return NextResponse.json({
      ok: true,
      test: 'eskiz_login',
      login_ok: true,
      token_received: Boolean(token),
      elapsed_ms: Date.now() - started,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      test: 'eskiz_login',
      login_ok: false,
      token_received: false,
      elapsed_ms: Date.now() - started,
      error: error instanceof Error ? error.message : 'Eskiz login xatosi.',
    }, { status: 502 })
  }
}

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()
    const normalizedPhone = normalizePhone(phone)

    if (!/^\+998\d{9}$/.test(normalizedPhone)) {
      return NextResponse.json({ error: 'Telefon raqami noto‘g‘ri.' }, { status: 400 })
    }

    const admin = getAdminClient()
    const now = new Date()
    const cooldownSince = new Date(now.getTime() - RESEND_COOLDOWN_SECONDS * 1000).toISOString()

    const { data: recentCode, error: recentError } = await admin
      .from('sms_otp_codes')
      .select('created_at')
      .eq('phone', normalizedPhone)
      .gte('created_at', cooldownSince)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentError) throw new Error(recentError.message)
    if (recentCode) {
      return NextResponse.json(
        { error: 'Yangi kodni 60 soniyadan keyin so‘rashingiz mumkin.' },
        { status: 429 },
      )
    }

    const code = randomInt(100000, 1000000).toString()
    const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000).toISOString()

    const { error: insertError } = await admin.from('sms_otp_codes').insert({
      phone: normalizedPhone,
      code_hash: hashOtp(code),
      expires_at: expiresAt,
    })
    if (insertError) throw new Error(insertError.message)

    const message = `RoyalHouse tasdiqlash kodi: ${code}. Kod 5 daqiqa amal qiladi.`
    await sendEskizSms(normalizedPhone, message)

    return NextResponse.json({ ok: true, testMode: false, message: 'SMS kodi yuborildi.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'SMS yuborilmadi.' },
      { status: 502 },
    )
  }
}
