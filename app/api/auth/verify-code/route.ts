import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TEST_CODE = process.env.AUTH_TEST_OTP || '321321'

export async function POST(request: Request) {
  if (process.env.AUTH_TEST_MODE !== 'true') {
    return NextResponse.status(503).json({ error: 'SMS tasdiqlash xizmati hali sozlanmagan.' })
  }

  const { phone, code } = await request.json()
  const normalizedPhone = String(phone || '').replace(/\s/g, '')
  const normalizedCode = String(code || '')

  if (!/^\+998\d{9}$/.test(normalizedPhone)) {
    return NextResponse.status(400).json({ error: 'Telefon raqami noto‘g‘ri.' })
  }

  if (normalizedCode !== TEST_CODE) {
    return NextResponse.status(401).json({ error: 'Tasdiqlash kodi noto‘g‘ri.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.status(500).json({ error: 'Supabase server kaliti sozlanmagan.' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listError) return NextResponse.status(500).json({ error: listError.message })

  let user = usersData.users.find((item) => item.phone === normalizedPhone)

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      phone: normalizedPhone,
      phone_confirm: true,
      password: TEST_CODE,
    })
    if (error) return NextResponse.status(500).json({ error: error.message })
    user = data.user
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: TEST_CODE,
      phone_confirm: true,
    })
    if (error) return NextResponse.status(500).json({ error: error.message })
    user = data.user
  }

  const authClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '', {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
    phone: normalizedPhone,
    password: TEST_CODE,
  })

  if (signInError || !sessionData.session) {
    return NextResponse.status(500).json({ error: signInError?.message || 'Sessiya yaratilmadi.' })
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
