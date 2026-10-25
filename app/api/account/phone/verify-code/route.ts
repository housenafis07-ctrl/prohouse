import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

const MAX_ATTEMPTS = 5

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`
  if (digits.length === 9) return `+998${digits}`
  return ''
}

function hashOtp(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export async function POST(request: Request) {
  try {
    const auth = await createServerClient()
    const { data: { user: currentUser } } = await auth.auth.getUser()
    if (!currentUser) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const { phone, code } = await request.json().catch(() => ({}))
    const normalizedPhone = normalizePhone(phone)
    const normalizedCode = String(code || '').trim()
    if (!/^\+998\d{9}$/.test(normalizedPhone)) return NextResponse.json({ error: 'Telefon raqami noto‘g‘ri.' }, { status: 400 })
    if (!/^\d{6}$/.test(normalizedCode)) return NextResponse.json({ error: 'Tasdiqlash kodi 6 xonali bo‘lishi kerak.' }, { status: 400 })

    const db = serviceClient()
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
    if ((otp.attempts || 0) >= MAX_ATTEMPTS) return NextResponse.json({ error: 'Urinishlar soni tugadi. Yangi kod so‘rang.' }, { status: 429 })

    if (hashOtp(normalizedCode) !== otp.code_hash) {
      await db.from('sms_otp_codes').update({ attempts: (otp.attempts || 0) + 1 }).eq('id', otp.id)
      return NextResponse.json({ error: 'Tasdiqlash kodi noto‘g‘ri.' }, { status: 401 })
    }

    const { error: usedError } = await db.from('sms_otp_codes').update({ used_at: new Date().toISOString() }).eq('id', otp.id).is('used_at', null)
    if (usedError) throw usedError

    const { data: currentProfile, error: currentProfileError } = await db.from('profiles').select('id,phone').eq('id', currentUser.id).maybeSingle()
    if (currentProfileError) throw currentProfileError
    if (!currentProfile) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 })

    const { data: targetProfile, error: targetError } = await db
      .from('profiles')
      .select('id,phone,full_name')
      .eq('phone', normalizedPhone)
      .neq('id', currentUser.id)
      .maybeSingle()
    if (targetError) throw targetError

    if (!targetProfile) {
      const { error } = await db.from('profiles').update({ phone: normalizedPhone }).eq('id', currentUser.id)
      if (error) throw error
      return NextResponse.json({ ok: true, merged: false, phone: normalizedPhone })
    }

    // If the phone already belongs to another profile, keep that profile as
    // canonical and move the Telegram profile's data to it. Never silently
    // overwrite a second Telegram identity.
    const { data: sourceTelegram } = await db
      .from('telegram_user_links')
      .select('telegram_user_id,telegram_username,chat_id')
      .eq('profile_id', currentUser.id)
      .maybeSingle()

    const { data: targetTelegram } = await db
      .from('telegram_user_links')
      .select('telegram_user_id')
      .eq('profile_id', targetProfile.id)
      .maybeSingle()

    if (targetTelegram && sourceTelegram && targetTelegram.telegram_user_id !== sourceTelegram.telegram_user_id) {
      return NextResponse.json({ error: 'Bu telefon raqami boshqa Telegram akkauntiga ham bog‘langan. Avval o‘sha Telegram ulanishini uzing.' }, { status: 409 })
    }

    if (targetTelegram && sourceTelegram?.telegram_user_id === targetTelegram.telegram_user_id) {
      await db.from('telegram_user_links').delete().eq('profile_id', currentUser.id)
    }

    const { error: mergeError } = await db.rpc('merge_profile_accounts', {
      source_profile_id: currentUser.id,
      target_profile_id: targetProfile.id,
    })
    if (mergeError) {
      console.error('[phone-link] profile merge failed', mergeError)
      return NextResponse.json({ error: 'Mavjud profil bilan birlashtirishda xatolik yuz berdi. Ma’lumotlar xavfsizligi uchun o‘zgarishlar bekor qilindi.' }, { status: 409 })
    }

    const targetAuth = serviceClient()
    const { data: targetUserData, error: targetUserError } = await targetAuth.auth.admin.getUserById(targetProfile.id)
    if (targetUserError || !targetUserData.user?.email) {
      return NextResponse.json({ error: 'Mavjud profilning autentifikatsiya ma’lumotlari topilmadi.' }, { status: 409 })
    }

    // Create a session for the canonical phone profile without asking for its
    // password. The current Telegram session is replaced only after the target
    // session has been successfully created.
    const magic = await targetAuth.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUserData.user.email,
    })
    if (magic.error || !magic.data?.properties?.hashed_token) {
      return NextResponse.json({ error: magic.error?.message || 'Yangi profil sessiyasi yaratilmadi.' }, { status: 500 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !publishableKey) throw new Error('Supabase publishable key sozlanmagan.')
    const publicAuth = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: targetSession, error: sessionError } = await publicAuth.auth.verifyOtp({
      token_hash: magic.data.properties.hashed_token,
      type: 'magiclink',
    })
    if (sessionError || !targetSession.session) {
      return NextResponse.json({ error: sessionError?.message || 'Yangi profil sessiyasi yaratilmadi.' }, { status: 500 })
    }

    // The source auth account is now redundant. Delete it only after the target
    // session exists; the browser will switch to the target session below.
    const { error: deleteError } = await targetAuth.auth.admin.deleteUser(currentUser.id)
    if (deleteError) {
      console.warn('[phone-link] source auth cleanup skipped', deleteError)
    }

    return NextResponse.json({
      ok: true,
      merged: true,
      phone: normalizedPhone,
      session: {
        access_token: targetSession.session.access_token,
        refresh_token: targetSession.session.refresh_token,
      },
    })
  } catch (error) {
    console.error('[phone-link] verification failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Telefon raqamini bog‘lab bo‘lmadi.' }, { status: 500 })
  }
}
