import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { telegramAuthEmail, telegramAuthPassword, validateTelegramInitData } from '@/app/lib/telegram-miniapp'

export const runtime = 'nodejs'

/**
 * Telegram Mini App authentication is intentionally limited to users who have
 * already linked their Telegram account from an existing RoyalHouse account.
 * Opening the Mini App must NEVER create a RoyalHouse account automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const validated = validateTelegramInitData(initData)
    if (!validated) {
      return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401 })
    }

    const { user: tgUser } = validated
    const admin = serviceClient()
    const telegramUserId = String(tgUser.id)

    const { data: existingLink, error: linkLookupError } = await admin
      .from('telegram_user_links')
      .select('profile_id,telegram_username,chat_id')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()

    if (linkLookupError) throw linkLookupError

    // Telegram is not a registration mechanism. A user must first have an
    // existing RoyalHouse profile and explicitly link Telegram from the
    // account settings. Never call auth.admin.createUser() here.
    const profileId = existingLink?.profile_id || null
    if (!profileId) {
      return NextResponse.json({
        error: 'TELEGRAM_ACCOUNT_NOT_LINKED',
        message: 'Telegram akkaunti RoyalHouse profiliga ulanmagan. Avval RoyalHouse saytida akkaunt yarating yoki mavjud akkauntingizga kiring va Profil sozlamalaridan Telegramni ulang.',
      }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const { data: profile, error: profileLookupError } = await admin
      .from('profiles')
      .select('id,full_name,phone')
      .eq('id', profileId)
      .maybeSingle()

    if (profileLookupError) throw profileLookupError
    if (!profile) {
      return NextResponse.json({
        error: 'TELEGRAM_PROFILE_NOT_FOUND',
        message: 'RoyalHouse profilingiz topilmadi. Iltimos, akkauntingizdan Telegram ulanishini qayta tekshiring.',
      }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const email = telegramAuthEmail(tgUser.id)
    const password = telegramAuthPassword(tgUser.id)
    const { createClient } = await import('@/utils/supabase/server')
    const authClient = await createClient()

    // Existing linked Telegram accounts use the deterministic credentials
    // created by the legacy Telegram integration. If a legacy account has a
    // mismatched password, repair only that already-existing account; never
    // create a new auth user.
    let { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({ email, password })

    if (signInError) {
      const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(profileId)
      if (authUserError) throw authUserError

      if (authUser.user?.user_metadata?.auth_provider !== 'telegram') {
        return NextResponse.json({
          error: 'TELEGRAM_AUTH_REQUIRES_RELINK',
          message: 'Telegram ulanishi tasdiqlanmadi. RoyalHouse kabinetidan Telegram ulanishini qayta bajaring.',
        }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
      }

      const { error: passwordUpdateError } = await admin.auth.admin.updateUserById(profileId, { password })
      if (passwordUpdateError) throw passwordUpdateError

      const retry = await authClient.auth.signInWithPassword({ email, password })
      signInData = retry.data
      signInError = retry.error
    }

    if (signInError || !signInData.session) {
      return NextResponse.json({
        error: 'TELEGRAM_SESSION_CREATE_FAILED',
        message: 'Telegram orqali kirish vaqtincha amalga oshmadi. RoyalHouse kabinetidan Telegram ulanishini qayta tekshiring.',
      }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const telegramUsername = tgUser.username || null
    if (
      existingLink.telegram_username !== telegramUsername ||
      existingLink.chat_id !== telegramUserId
    ) {
      const { error: telegramLinkError } = await admin
        .from('telegram_user_links')
        .update({
          chat_id: telegramUserId,
          telegram_username: telegramUsername,
        })
        .eq('profile_id', profileId)
        .eq('telegram_user_id', telegramUserId)

      if (telegramLinkError) throw telegramLinkError
    }

    return NextResponse.json({
      ok: true,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
      profile: {
        id: profileId,
        fullName: profile.full_name || '',
        phone: profile.phone || null,
        hasPhone: Boolean(profile.phone),
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[Telegram auth] failed', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'TELEGRAM_AUTH_FAILED',
    }, { status: 500 })
  }
}
