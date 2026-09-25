import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const MAX_ATTEMPTS = 5

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`
  return ''
}

function hashOtp(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export async function POST(request: Request) {
  const { phone, code } = await request.json()
  const normalizedPhone = normalizePhone(phone)
  const normalizedCode = String(code || '').trim()

  if (!/^\+998\d{9}$/.test(normalizedPhone)) {
    return NextResponse.json({ error: 'Telefon raqami noto‘g‘ri.' }, { status: 400 })
  }

  if (!/^\d{6}$/.test(normalizedCode)) {
    return NextResponse.json({ error: 'Tasdiqlash kodi 6 xonali bo‘lishi kerak.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase server kaliti sozlanmagan.' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: otp, error: otpLookupError } = await admin
    .from('sms_otp_codes')
    .select('id, code_hash, expires_at, attempts')
    .eq('phone', normalizedPhone)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (otpLookupError) return NextResponse.json({ error: otpLookupError.message }, { status: 500 })

  if (!otp) {
    return NextResponse.json({ error: 'Tasdiqlash kodi topilmadi. Yangi kod so‘rang.' }, { status: 401 })
  }

  if (new Date(otp.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Tasdiqlash kodi muddati tugagan. Yangi kod so‘rang.' }, { status: 401 })
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Urinishlar soni tugadi. Yangi kod so‘rang.' }, { status: 429 })
  }

  const isValid = hashOtp(normalizedCode) === otp.code_hash

  if (!isValid) {
    const nextAttempts = otp.attempts + 1
    await admin.from('sms_otp_codes').update({ attempts: nextAttempts }).eq('id', otp.id)
    return NextResponse.json({ error: 'Tasdiqlash kodi noto‘g‘ri.' }, { status: 401 })
  }

  const { error: usedError } = await admin
    .from('sms_otp_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', otp.id)
    .is('used_at', null)

  if (usedError) return NextResponse.json({ error: usedError.message }, { status: 500 })

  // Telefon bo‘yicha mavjud Royalhouse profilini topamiz.
  // Profil ID auth.users.id bilan bir xil bo‘lib, eski e’lonlarning owner_id qiymati shu ID'ga bog‘langan.
  const { data: existingProfile, error: profileLookupError } = await admin
    .from('profiles')
    .select('id, phone')
    .eq('phone', normalizedPhone)
    .maybeSingle()

  if (profileLookupError) {
    return NextResponse.json({ error: profileLookupError.message }, { status: 500 })
  }

  const authEmail = `${normalizedPhone.slice(1)}@test.royalhouse.local`
  let user

  const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

  if (existingProfile?.id) {
    const { data: existingUserData, error: existingUserError } = await admin.auth.admin.getUserById(existingProfile.id)
    if (existingUserError || !existingUserData.user) {
      return NextResponse.json(
        { error: existingUserError?.message || 'Mavjud foydalanuvchi topilmadi.' },
        { status: 500 },
      )
    }

    const emailOwner = usersData.users.find(
      (item) => item.email?.toLowerCase() === authEmail.toLowerCase() && item.id !== existingProfile.id,
    )

    if (emailOwner) {
      const reservedEmail = `${normalizedPhone.slice(1)}+duplicate-${emailOwner.id}@test.royalhouse.local`
      const { error: reserveError } = await admin.auth.admin.updateUserById(emailOwner.id, {
        email: reservedEmail,
        email_confirm: true,
      })
      if (reserveError) {
        return NextResponse.json(
          { error: `Duplicate Auth foydalanuvchisini ajratib bo‘lmadi: ${reserveError.message}` },
          { status: 500 },
        )
      }
    }

    const { data, error } = await admin.auth.admin.updateUserById(existingProfile.id, {
      email: authEmail,
      email_confirm: true,
      password: normalizedCode,
      user_metadata: { ...(existingUserData.user.user_metadata || {}), phone: normalizedPhone },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    user = data.user
  } else {
    user = usersData.users.find((item) => item.email === authEmail || item.phone === normalizedPhone)

    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: authEmail,
        email_confirm: true,
        password: normalizedCode,
        user_metadata: { phone: normalizedPhone },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      user = data.user
    } else {
      const { data, error } = await admin.auth.admin.updateUserById(user.id, {
        email: authEmail,
        email_confirm: true,
        password: normalizedCode,
        user_metadata: { ...(user.user_metadata || {}), phone: normalizedPhone },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      user = data.user
    }
  }

  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!publishableKey) {
    return NextResponse.json({ error: 'Supabase publishable key sozlanmagan.' }, { status: 500 })
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
    email: authEmail,
    password: normalizedCode,
  })

  if (signInError || !sessionData.session) {
    return NextResponse.json(
      { error: signInError?.message || 'Sessiya yaratilmadi.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    testMode: false,
    userId: user.id,
    session: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    },
  })
}
