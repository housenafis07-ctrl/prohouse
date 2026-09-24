import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TEST_CODE = process.env.AUTH_TEST_OTP || '321321'

export async function POST(request: Request) {
  if (process.env.AUTH_TEST_MODE !== 'true') {
    return NextResponse.json(
      { error: 'SMS tasdiqlash xizmati hali sozlanmagan.' },
      { status: 503 },
    )
  }

  const { phone, code } = await request.json()
  const normalizedPhone = String(phone || '').replace(/\s/g, '')
  const normalizedCode = String(code || '')

  if (!/^\+998\d{9}$/.test(normalizedPhone)) {
    return NextResponse.json(
      { error: 'Telefon raqami noto‘g‘ri.' },
      { status: 400 },
    )
  }

  if (normalizedCode !== TEST_CODE) {
    return NextResponse.json(
      { error: 'Tasdiqlash kodi noto‘g‘ri.' },
      { status: 401 },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Supabase server kaliti sozlanmagan.' },
      { status: 500 },
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

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

  const testEmail = `${normalizedPhone.slice(1)}@test.royalhouse.local`
  let user

  // Auth'da bir xil telefon uchun avval yaratilgan test foydalanuvchilari bo‘lishi mumkin.
  // Avval ularni topamiz, chunki testEmail boshqa (yetim/duplicate) user'da band bo‘lsa,
  // to‘g‘ri profilni update qilishda "Error updating user" chiqadi.
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

    // testEmail boshqa auth user'da band bo‘lsa, o‘sha duplicate user'ni xavfsiz
    // rezerv emailga ko‘chiramiz. Profil va e’lonlar tegilmaydi.
    const emailOwner = usersData.users.find(
      (item) => item.email?.toLowerCase() === testEmail.toLowerCase() && item.id !== existingProfile.id,
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
      email: testEmail,
      email_confirm: true,
      password: TEST_CODE,
      user_metadata: { ...(existingUserData.user.user_metadata || {}), phone: normalizedPhone },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    user = data.user
  } else {
    // Yangi foydalanuvchi uchun avvalgi test-auth oqimini saqlaymiz.
    user = usersData.users.find((item) => item.email === testEmail || item.phone === normalizedPhone)

    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: testEmail,
        email_confirm: true,
        password: TEST_CODE,
        user_metadata: { phone: normalizedPhone },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      user = data.user
    } else {
      const { data, error } = await admin.auth.admin.updateUserById(user.id, {
        email: testEmail,
        email_confirm: true,
        password: TEST_CODE,
        user_metadata: { ...(user.user_metadata || {}), phone: normalizedPhone },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      user = data.user
    }
  }

  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!publishableKey) {
    return NextResponse.json(
      { error: 'Supabase publishable key sozlanmagan.' },
      { status: 500 },
    )
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
    email: testEmail,
    password: TEST_CODE,
  })

  if (signInError || !sessionData.session) {
    return NextResponse.json(
      { error: signInError?.message || 'Sessiya yaratilmadi.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    testMode: true,
    userId: user.id,
    session: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    },
  })
}
