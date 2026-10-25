import { NextResponse } from 'next/server'
import { randomInt, createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const ESKIZ_BASE_URL = 'https://notify.eskiz.uz'
const OTP_TTL_SECONDS = 5 * 60
const RESEND_COOLDOWN_SECONDS = 60

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`
  if (digits.length === 9) return `+998${digits}`
  return ''
}

function hashOtp(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

function adminClient() {
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
  const response = await fetch(`${ESKIZ_BASE_URL}/api/auth/login`, { method: 'POST', body, cache: 'no-store' })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.data?.token) throw new Error(data?.message || data?.error || `Eskiz login xatosi (${response.status}).`)
  return String(data.data.token)
}

async function sendSms(phone: string, message: string) {
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
    if (response.ok) return
    if (response.status === 401 && attempt === 0) {
      token = await eskizLogin()
      continue
    }
    throw new Error(data?.message || data?.error || `Eskiz SMS xatosi (${response.status}).`)
  }
}

export async function POST(request: Request) {
  try {
    const { phone } = await request.json().catch(() => ({}))
    const normalizedPhone = normalizePhone(phone)
    if (!/^\+998\d{9}$/.test(normalizedPhone)) {
      return NextResponse.json({ error: 'Telefon raqamini to‘g‘ri kiriting.' }, { status: 400 })
    }

    const auth = adminClient()
    const now = new Date()
    const cooldownSince = new Date(now.getTime() - RESEND_COOLDOWN_SECONDS * 1000).toISOString()
    const { data: recent, error: recentError } = await auth
      .from('sms_otp_codes')
      .select('id')
      .eq('phone', normalizedPhone)
      .gte('created_at', cooldownSince)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (recentError) throw recentError
    if (recent) return NextResponse.json({ error: 'Yangi kodni 60 soniyadan keyin so‘rashingiz mumkin.' }, { status: 429 })

    const code = randomInt(100000, 1000000).toString()
    const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000).toISOString()
    const { data: otp, error: insertError } = await auth.from('sms_otp_codes').insert({
      phone: normalizedPhone,
      code_hash: hashOtp(code),
      expires_at: expiresAt,
    }).select('id').single()
    if (insertError) throw insertError

    try {
      await sendSms(normalizedPhone, `royalhouse.uz saytiga kirish uchun tasdiqlash kodi: ${code}`)
    } catch (error) {
      await auth.from('sms_otp_codes').delete().eq('id', otp.id)
      throw error
    }

    return NextResponse.json({ ok: true, message: 'SMS kodi yuborildi.' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'SMS yuborilmadi.' }, { status: 502 })
  }
}
