import { NextResponse } from 'next/server'
import { createHash, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const OTP_TTL_MS = 5 * 60 * 1000
const TEST_EMAIL_DOMAIN = '@test.royalhouse.local'

function normalizePhone(value: unknown) {
  return String(value || '').replace(/\s/g, '')
}

function otpHash(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

async function eskizLogin(email: string, password: string) {
  const form = new FormData()
  form.append('email', email)
  form.append('password', password)

  const response = await fetch('https://notify.eskiz.uz/api/auth/login', {
    method: 'POST',
    body: form,
    cache: 'no-store',
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Eskiz login xatosi (${response.status})`)
  }

  const token = data?.data?.token || data?.token
  if (!token) throw new Error('Eskiz token qaytarmadi.')
  return token as string
}

async function eskizSendSms(token: string, phone: string, message: string, from: string) {
  const form = new FormData()
  form.append('mobile_phone', phone.replace(/^\+/, ''))
  form.append('message', message)
  form.append('from', from)

  const response = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    cache: 'no-store',
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Eskiz SMS xatosi (${response.status})`)
  }

  return data
}

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()
    const normalizedPhone = normalizePhone(phone)

    if (!/^\+998\d{9}$/.test(normalizedPhone)) {
      return NextResponse.json({ error: 'Telefon raqami noto‘g‘ri.' }, { status: 400 })
    }

    const eskizEmail = process.env.ESKIZ_EMAIL
    const eskizPassword = process.env.ESKIZ_PASSWORD
    const eskizFrom = process.env.ESKIZ_FROM || '4546'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!eskizEmail || !eskizPassword || !supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'SMS xizmati uchun server sozlamalari to‘liq emas.' },
        { status: 500 },
      )
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: existingProfile, error: profileLookupError } = await admin
      .from('profiles')
      .select('id, phone')
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (profileLookupError) {
      return NextResponse.json({ error: profileLookupError.message }, { status: 500 })
    }

    const testEmail = `${normalizedPhone.slice(1)}${TEST_EMAIL_DOMAIN}`
    const code = randomInt(100000, 1000000).toString()
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()
    const metadata = {
      phone: normalizedPhone,
      otp_hash: otpHash(code),
      otp_expires_at: expiresAt,
    }

    let userId: string | undefined

    if (existingProfile?.id) {
      const { data: existingUserData, error: existingUserError } = await admin.auth.admin.getUserById(existingProfile.id)
      if (existingUserError || !existingUserData.user) {
        return NextResponse.json(
          { error: existingUserError?.message || 'Mavjud foydalanuvchi topilmadi.' },
          { status: 500 },
        )
      }

      const { error } = await admin.auth.admin.updateUserById(existingProfile.id, {
        email: testEmail,
        email_confirm: true,
        password: code,
        user_metadata: { ...(existingUserData.user.user_metadata || {}), ...metadata },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      userId = existingProfile.id
    } else {
      const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
      if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

      const existingUser = usersData.users.find(
        (item) => item.email?.toLowerCase() === testEmail.toLowerCase() || item.phone === normalizedPhone,
      )

      if (existingUser) {
        const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
          email: testEmail,
          email_confirm: true,
          password: code,
          user_metadata: { ...(existingUser.user_metadata || {}), ...metadata },
        })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        userId = existingUser.id
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: testEmail,
          email_confirm: true,
          password: code,
          user_metadata: metadata,
        })
        if (error || !data.user) {
          return NextResponse.json({ error: error?.message || 'Foydalanuvchi yaratilmadi.' }, { status: 500 })
        }
        userId = data.user.id
      }
    }

    const message = `royalhouse.uz saytiga kirish uchun tasdiqlash kodi: ${code}`
    let token = await eskizLogin(eskizEmail, eskizPassword)

    try {
      await eskizSendSms(token, normalizedPhone, message, eskizFrom)
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      if (/401|403/.test(text)) {
        token = await eskizLogin(eskizEmail, eskizPassword)
        await eskizSendSms(token, normalizedPhone, message, eskizFrom)
      } else {
        throw error
      }
    }

    return NextResponse.json({ ok: true, testMode: false, userId })
  } catch (error) {
    console.error('Royalhouse SMS send error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'SMS yuborishda xatolik yuz berdi.' },
      { status: 502 },
    )
  }
}
