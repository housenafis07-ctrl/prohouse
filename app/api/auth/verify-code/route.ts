import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TEST_CODE = process.env.AUTH_TEST_OTP || '321321'

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 9 ? digits.slice(-9) : digits
}

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

  // Existing users are identified from profiles.phone first. This prevents
  // an old account from being replaced by a new Auth user just because its
  // legacy Auth email/phone fields use a different format.
  const targetPhone = normalizePhone(normalizedPhone)
  let profileUserId: string | null = null
  let profileOffset = 0

  while (!profileUserId) {
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id,phone')
      .range(profileOffset, profileOffset + 999)

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }

    const match = (profiles || []).find((profile) => normalizePhone(profile.phone) === targetPhone)
    if (match) {
      profileUserId = match.id
      break
    }

    if (!profiles || profiles.length < 1000) break
    profileOffset += 1000
  }

  const testEmail = `${normalizedPhone.slice(1)}@test.royalhouse.local`
  let user = null

  // If a profile already exists, restore/login to that exact Auth user.
  if (profileUserId) {
    const { data, error } = await admin.auth.admin.getUserById(profileUserId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    user = data.user
  }

  // Fallback for Auth-only legacy users.
  if (!user) {
    let page = 1
    while (!user) {
      const { data: usersData, error: listError } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      })
      if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

      user = usersData.users.find(
        (item) => item.email === testEmail || item.phone === normalizedPhone,
      ) || null

      if (user || usersData.users.length < 1000) break
      page += 1
    }
  }

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
      phone: normalizedPhone,
      phone_confirm: true,
      password: TEST_CODE,
      user_metadata: { phone: normalizedPhone },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    user = data.user
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      email: testEmail,
      email_confirm: true,
      phone: normalizedPhone,
      phone_confirm: true,
      password: TEST_CODE,
      user_metadata: { ...(user.user_metadata || {}), phone: normalizedPhone },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    user = data.user
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
