import { NextResponse } from 'next/server'
import { createHash, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// OTP generation uses node:crypto and the Eskiz integration uses Node-compatible
// server APIs. Pin this endpoint to the Node.js runtime instead of relying on
// deployment defaults (an Edge/runtime mismatch can fail before the handler
// returns a JSON response).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ESKIZ_BASE_URL = 'https://notify.eskiz.uz'
const OTP_TTL_SECONDS = 5 * 60
const RESEND_COOLDOWN_SECONDS = 60
const ESKIZ_TOKEN_RETRY_DELAY_MS = 1500

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

function isEskizTokenTimingError(data: any) {
  const message = String(data?.message || data?.error || '').toLowerCase()
  return message.includes('token used before issued') || message.includes('token used too early') || message.includes('not yet valid')
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function eskizLogin() {
  const email = process.env.ESKIZ_EMAIL
  const password = process.env.ESKIZ_PASSWORD
  if (!email || !password) throw new Error('ESKIZ_EMAIL yoki ESKIZ_PASSWORD sozlanmagan.')

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const body = new FormData()
    body.append('email', email)
    body.append('password', password)

    const response = await fetch(`${ESKIZ_BASE_URL}/api/auth/login`, {
      method: 'POST',
      body,
      cache: 'no-store',
    })

    const data = await response.json().catch(() => null)
    if (response.ok && data?.data?.token) return data.data.token as string

    if (isEskizTokenTimingError(data) && attempt === 0) {
      await sleep(ESKIZ_TOKEN_RETRY_DELAY_MS)
      continue
    }

    throw new Error(data?.message || data?.error || `Eskiz login xatosi (${response.status}).`)
  }

  throw new Error('Eskiz login xatosi.')
}

async function sendEskizSms(phone: string, message: string) {
  const from = process.env.ESKIZ_FROM || '4546'
  let token = await eskizLogin()

  for (let attempt = 0; attempt < 3; attempt += 1) {
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

    if ((response.status === 401 || isEskizTokenTimingError(data)) && attempt < 2) {
      await sleep(ESKIZ_TOKEN_RETRY_DELAY_MS)
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
  let admin: ReturnType<typeof getAdminClient> | null = null
  let insertedOtpId: string | null = null

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'So‘rov ma’lumotlari noto‘g‘ri.' }, { status: 400 })
    }
    const { phone } = body as { phone?: unknown }
    const normalizedPhone = normalizePhone(phone)

    if (!/^\+998\d{9}$/.test(normalizedPhone)) {
      return NextResponse.json({ error: 'Telefon raqami noto‘g‘ri.' }, { status: 400 })
    }

    admin = getAdminClient()
    const now = new Date()
    const code = randomInt(100000, 1000000).toString()
    const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000).toISOString()

    const { data: reservedOtp, error: reserveError } = await admin.rpc('reserve_sms_otp', {
      p_phone: normalizedPhone,
      p_code_hash: hashOtp(code),
      p_expires_at: expiresAt,
      p_cooldown_seconds: RESEND_COOLDOWN_SECONDS,
    })
    if (reserveError) {
      if (reserveError.message?.includes('OTP_RESEND_COOLDOWN')) {
        return NextResponse.json({ error: 'Yangi kodni 60 soniyadan keyin so‘rashingiz mumkin.' }, { status: 429 })
      }
      throw new Error(reserveError.message)
    }
    insertedOtpId = reservedOtp as string

    // Keep the approved Eskiz SMS template unchanged.
    // Do not append @/# WebOTP markers: they can cause Eskiz moderation to reject the text.
    const message = `royalhouse.uz saytiga kirish uchun tasdiqlash kodi: ${code}`
    await sendEskizSms(normalizedPhone, message)

    return NextResponse.json({ ok: true, testMode: false, message: 'SMS kodi yuborildi.' })
  } catch (error) {
    // Keep the failure visible in Vercel runtime logs without exposing secrets.
    console.error('[auth/send-code] SMS request failed:', error)

    // If the provider rejected the send, do not leave a fresh unused OTP that
    // blocks the user from immediately requesting another code. Cleanup must
    // never prevent the API from returning a structured error response.
    if (admin && insertedOtpId) {
      try {
        const { error: cleanupError } = await admin.from('sms_otp_codes').delete().eq('id', insertedOtpId)
        if (cleanupError) console.error('[auth/send-code] OTP cleanup failed:', cleanupError.message)
      } catch (cleanupError) {
        console.error('[auth/send-code] OTP cleanup threw:', cleanupError)
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'SMS yuborilmadi.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
