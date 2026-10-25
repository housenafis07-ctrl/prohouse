import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

export const runtime = 'nodejs'

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
  try {
    const auth = await createClient()
    const { data: { user: currentUser } } = await auth.auth.getUser()
    if (!currentUser) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const body = await request.json()
    const normalizedPhone = normalizePhone(body?.phone)
    const normalizedCode = String(body?.code || '').trim()

    if (!/^\+998\d{9}$/.test(normalizedPhone)) {
      return NextResponse.json({ error: 'Telefon raqami noto‘g‘ri.' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json({ error: 'Tasdiqlash kodi 6 xonali bo‘lishi kerak.' }, { status: 400 })
    }

    const db = serviceClient()
    const { data: currentProfile, error: currentProfileError } = await db
      .from('profiles')
      .select('id,phone')
      .eq('id', currentUser.id)
      .maybeSingle()
    if (currentProfileError) throw currentProfileError
    if (!currentProfile) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 })

    if (currentProfile.phone) {
      return NextResponse.json({ error: 'Telefon raqami allaqachon tasdiqlangan.' }, { status: 409 })
    }

    const { data: otp, error: otpError } = await db
      .from('sms_otp_codes')
      .select('id,code_hash,expires_at,attempts')
      .eq('phone', normalizedPhone)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (otpError) throw otpError
    if (!otp) return NextResponse.json({ error: 'Tasdiqlash kodi topilmadi. Yangi kod so‘rang.' }, { status: 401 })
    if (new Date(otp.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: 'Tasdiqlash kodi muddati tugagan. Yangi kod so‘rang.' }, { status: 401 })
    if (otp.attempts >= MAX_ATTEMPTS) return NextResponse.json({ error: 'Urinishlar soni tugadi. Yangi kod so‘rang.' }, { status: 429 })

    if (hashOtp(normalizedCode) !== otp.code_hash) {
      await db.from('sms_otp_codes').update({ attempts: otp.attempts + 1 }).eq('id', otp.id)
      return NextResponse.json({ error: 'Tasdiqlash kodi noto‘g‘ri.' }, { status: 401 })
    }

    const { error: usedError } = await db
      .from('sms_otp_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', otp.id)
      .is('used_at', null)
    if (usedError) throw usedError

    const { data: existingProfile, error: existingProfileError } = await db
      .from('profiles')
      .select('id,phone')
      .eq('phone', normalizedPhone)
      .maybeSingle()
    if (existingProfileError) throw existingProfileError

    const now = new Date().toISOString()
    const authEmail = `${normalizedPhone.slice(1)}@test.royalhouse.local`

    // If this phone already belongs to a real profile, merge only the current
    // Telegram-only placeholder into that profile. Never merge two real users.
    if (existingProfile && existingProfile.id !== currentUser.id) {
      const { data: targetAuth, error: targetAuthError } = await db.auth.admin.getUserById(existingProfile.id)
      if (targetAuthError || !targetAuth.user) throw targetAuthError || new Error('TARGET_AUTH_USER_NOT_FOUND')

      const telegramOnly =
        !currentProfile.phone &&
        currentUser.user_metadata?.auth_provider === 'telegram'

      if (!telegramOnly) {
        return NextResponse.json({ error: 'PHONE_ALREADY_LINKED_TO_ANOTHER_PROFILE' }, { status: 409 })
      }

      const { error: mergeError } = await db.rpc('merge_profile_accounts', {
        source_profile_id: currentUser.id,
        target_profile_id: existingProfile.id,
      })
      if (mergeError) throw mergeError

      const mergedMetadata = {
        ...(targetAuth.user.user_metadata || {}),
        phone: normalizedPhone,
        auth_provider: 'phone',
        telegram_user_id: currentUser.user_metadata?.telegram_user_id || targetAuth.user.user_metadata?.telegram_user_id,
      }

      const { error: targetUpdateError } = await db.auth.admin.updateUserById(existingProfile.id, {
        email: targetAuth.user.email || authEmail,
        email_confirm: true,
        password: normalizedCode,
        user_metadata: mergedMetadata,
      })
      if (targetUpdateError) throw targetUpdateError

      const { error: deleteSourceError } = await db.auth.admin.deleteUser(currentUser.id)
      if (deleteSourceError) throw deleteSourceError

      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!publishableKey || !supabaseUrl) throw new Error('Supabase kalitlari sozlanmagan.')
      const authClient = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
      const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
        email: targetAuth.user.email || authEmail,
        password: normalizedCode,
      })
      if (signInError || !sessionData.session) throw signInError || new Error('Sessiya yaratilmadi.')

      const { data: profile } = await db
        .from('profiles')
        .select('phone,full_name,account_type,partner_type,company_name,inn,bank_name,bank_account,mfo,oked,director_full_name')
        .eq('id', existingProfile.id)
        .maybeSingle()

      return NextResponse.json({
        ok: true,
        merged: true,
        profile,
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        },
      })
    }

    // No existing phone profile: attach the verified number to the current
    // Telegram profile and keep its Telegram identity/session data intact.
    const { error: profileUpdateError } = await db
      .from('profiles')
      .update({ phone: normalizedPhone })
      .eq('id', currentUser.id)
    if (profileUpdateError) throw profileUpdateError

    const { error: authUpdateError } = await db.auth.admin.updateUserById(currentUser.id, {
      email: currentUser.email || authEmail,
      email_confirm: true,
      password: normalizedCode,
      user_metadata: {
        ...(currentUser.user_metadata || {}),
        phone: normalizedPhone,
        auth_provider: 'phone',
      },
    })
    if (authUpdateError) throw authUpdateError

    const { data: botLink } = await db
      .from('telegram_user_links')
      .select('telegram_user_id,chat_id,telegram_username')
      .eq('profile_id', currentUser.id)
      .maybeSingle()

    if (botLink) {
      await db.from('telegram_user_links').update({ linked_at: now, verified_at: now }).eq('profile_id', currentUser.id)
      await db.from('telegram_bot_users').update({ auth_user_id: currentUser.id, profile_id: currentUser.id, is_active: true, blocked_at: null, updated_at: now }).eq('telegram_user_id', botLink.telegram_user_id)
    }

    const { data: profile } = await db
      .from('profiles')
      .select('phone,full_name,account_type,partner_type,company_name,inn,bank_name,bank_account,mfo,oked,director_full_name')
      .eq('id', currentUser.id)
      .maybeSingle()

    const { data: sessionData, error: signInError } = await auth.auth.signInWithPassword({
      email: currentUser.email || authEmail,
      password: normalizedCode,
    })

    return NextResponse.json({
      ok: true,
      merged: false,
      profile,
      session: signInError || !sessionData.session ? null : {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      },
    })
  } catch (error) {
    console.error('[phone-link] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'PHONE_LINK_FAILED' }, { status: 500 })
  }
}
