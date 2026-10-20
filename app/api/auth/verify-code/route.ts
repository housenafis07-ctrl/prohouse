import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'

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

  // When the user arrived through Telegram, keep Telegram and phone as two
  // identities of one canonical RoyalHouse account. Never silently create a
  // second account just because the phone was verified later.
  const browserAuth = await createServerClient()
  const { data: { user: currentUser } } = await browserAuth.auth.getUser()
  const currentUserId = currentUser?.id || null

  const { data: existingProfile, error: profileLookupError } = await admin
    .from('profiles')
    .select('id, phone')
    .eq('phone', normalizedPhone)
    .maybeSingle()

  if (profileLookupError) {
    return NextResponse.json({ error: profileLookupError.message }, { status: 500 })
  }

  let telegramSource: { id: string; telegramUserId: string; chatId: string } | null = null

  if (currentUserId && currentUserId !== existingProfile?.id) {
    const { data: currentProfile, error: currentProfileError } = await admin
      .from('profiles')
      .select('id,phone')
      .eq('id', currentUserId)
      .maybeSingle()
    if (currentProfileError) return NextResponse.json({ error: currentProfileError.message }, { status: 500 })

    const authProvider = currentUser?.user_metadata?.auth_provider
    if (authProvider === 'telegram' && !currentProfile?.phone) {
      const { data: sourceLink, error: sourceLinkError } = await admin
        .from('telegram_user_links')
        .select('profile_id,telegram_user_id,chat_id')
        .eq('profile_id', currentUserId)
        .maybeSingle()
      if (sourceLinkError) return NextResponse.json({ error: sourceLinkError.message }, { status: 500 })
      if (sourceLink) {
        telegramSource = {
          id: sourceLink.profile_id,
          telegramUserId: sourceLink.telegram_user_id,
          chatId: sourceLink.chat_id,
        }
      }
    }
  }

  // Do not consume the OTP when an unsafe identity merge needs intervention.
  if (telegramSource && existingProfile?.id) {
    const { data: targetLink, error: targetLinkError } = await admin
      .from('telegram_user_links')
      .select('telegram_user_id')
      .eq('profile_id', existingProfile.id)
      .maybeSingle()
    if (targetLinkError) return NextResponse.json({ error: targetLinkError.message }, { status: 500 })

    if (targetLink && targetLink.telegram_user_id !== telegramSource.telegramUserId) {
      return NextResponse.json({
        error: 'Bu telefon raqami boshqa Telegram akkauntiga ulangan Royalhouse profilida mavjud.',
        code: 'PHONE_ACCOUNT_HAS_DIFFERENT_TELEGRAM',
      }, { status: 409 })
    }

    const { count: listingCount, error: listingCountError } = await admin
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', currentUserId)
    if (listingCountError) return NextResponse.json({ error: listingCountError.message }, { status: 500 })

    if ((listingCount || 0) > 0) {
      return NextResponse.json({
        error: 'Telegram profilida allaqachon e’lonlar mavjud. Akkauntlarni xavfsiz birlashtirish uchun qo‘llab-quvvatlash xizmatiga murojaat qiling.',
        code: 'TELEGRAM_ACCOUNT_HAS_DATA',
      }, { status: 409 })
    }
  }

  const { error: usedError } = await admin
    .from('sms_otp_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', otp.id)
    .is('used_at', null)

  if (usedError) return NextResponse.json({ error: usedError.message }, { status: 500 })

  const authEmail = `${normalizedPhone.slice(1)}@test.royalhouse.local`
  let user

  // Telegram-first user with a new phone: upgrade the same Auth user instead
  // of creating a second phone account.
  if (telegramSource && !existingProfile) {
    const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(currentUserId!, {
      email: authEmail,
      email_confirm: true,
      password: normalizedCode,
      user_metadata: {
        ...(currentUser?.user_metadata || {}),
        phone: normalizedPhone,
      },
    })
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    const { error: profileUpdateError } = await admin
      .from('profiles')
      .update({ phone: normalizedPhone })
      .eq('id', currentUserId!)
    if (profileUpdateError) return NextResponse.json({ error: profileUpdateError.message }, { status: 500 })

    user = updated.user
  } else {
    if (existingProfile?.id) {
      const { data: existingUserData, error: existingUserError } = await admin.auth.admin.getUserById(existingProfile.id)
      if (existingUserError || !existingUserData.user) {
        return NextResponse.json(
          { error: existingUserError?.message || 'Mavjud foydalanuvchi topilmadi.' },
          { status: 500 },
        )
      }

      const { data, error } = await admin.auth.admin.updateUserById(existingProfile.id, {
        email: authEmail,
        email_confirm: true,
        password: normalizedCode,
        user_metadata: { ...(existingUserData.user.user_metadata || {}), phone: normalizedPhone },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      user = data.user

      // The Telegram identity follows the verified phone owner. If the current
      // Telegram-only profile was empty, move its link and retire that duplicate
      // Auth user so future Telegram and phone logins resolve to one user_id.
      if (telegramSource && currentUserId && currentUserId !== existingProfile.id) {
        const { data: targetLink } = await admin
          .from('telegram_user_links')
          .select('telegram_user_id')
          .eq('profile_id', existingProfile.id)
          .maybeSingle()

        if (!targetLink) {
          const { error: moveLinkError } = await admin
            .from('telegram_user_links')
            .update({ profile_id: existingProfile.id, linked_at: new Date().toISOString() })
            .eq('profile_id', currentUserId)
          if (moveLinkError) return NextResponse.json({ error: moveLinkError.message }, { status: 500 })
        } else {
          const { error: removeSourceLinkError } = await admin
            .from('telegram_user_links')
            .delete()
            .eq('profile_id', currentUserId)
          if (removeSourceLinkError) return NextResponse.json({ error: removeSourceLinkError.message }, { status: 500 })
        }

        const { error: deleteDuplicateError } = await admin.auth.admin.deleteUser(currentUserId)
        if (deleteDuplicateError) return NextResponse.json({ error: deleteDuplicateError.message }, { status: 500 })
      }
    } else {
      // Legacy fallback for phone accounts created before the profile lookup
      // path existed. This is deliberately kept off the normal Telegram path.
      const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
      if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

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
