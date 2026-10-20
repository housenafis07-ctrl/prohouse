import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'
import { telegramAuthEmail, telegramAuthPassword, validateTelegramInitData } from '@/app/lib/telegram-miniapp'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const validated = validateTelegramInitData(initData)
    if (!validated) return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401, headers: noStore })

    const { user: tgUser } = validated
    const telegramUserId = String(tgUser.id)
    const admin = serviceClient()

    const { data: link, error: linkError } = await admin
      .from('telegram_user_links')
      .select('profile_id,verified_at,verification_method')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()
    if (linkError) throw linkError

    console.info('[telegram-auth] identity', {
      telegramUserId,
      mappedProfileId: link?.profile_id || null,
      verifiedAt: link?.verified_at || null,
      verificationMethod: link?.verification_method || null,
    })

    if (!link?.profile_id || !link.verified_at) {
      return NextResponse.json({ error: 'TELEGRAM_PHONE_VERIFICATION_REQUIRED' }, { status: 428, headers: noStore })
    }

    const profileId = link.profile_id
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id,full_name,phone')
      .eq('id', profileId)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile) return NextResponse.json({ error: 'TELEGRAM_PROFILE_NOT_FOUND' }, { status: 409, headers: noStore })

    const email = telegramAuthEmail(tgUser.id)
    const password = telegramAuthPassword(tgUser.id)
    const authClient = await createClient()
    let signIn = await authClient.auth.signInWithPassword({ email, password })

    if (signIn.error || !signIn.data.session || signIn.data.user?.id !== profileId) {
      const { error: passwordError } = await admin.auth.admin.updateUserById(profileId, {
        email,
        email_confirm: true,
        password,
        user_metadata: {
          auth_provider: 'telegram',
          telegram_user_id: telegramUserId,
          telegram_username: tgUser.username || null,
          telegram_first_name: tgUser.first_name || null,
          telegram_last_name: tgUser.last_name || null,
        },
      })
      if (passwordError) throw passwordError
      signIn = await authClient.auth.signInWithPassword({ email, password })
    }

    if (signIn.error || !signIn.data.session || signIn.data.user?.id !== profileId) {
      console.error('[telegram-auth] session mismatch', {
        telegramUserId,
        expectedProfileId: profileId,
        actualAuthUserId: signIn.data.user?.id || null,
      })
      return NextResponse.json({ error: 'TELEGRAM_SESSION_CREATE_FAILED' }, { status: 500, headers: noStore })
    }

    console.info('[telegram-auth] session ready', { telegramUserId, profileId })

    return NextResponse.json({
      ok: true,
      session: { access_token: signIn.data.session.access_token, refresh_token: signIn.data.session.refresh_token },
      profile: { id: profileId, fullName: profile.full_name || '', phone: profile.phone || null, hasPhone: Boolean(profile.phone) },
    }, { headers: noStore })
  } catch (error) {
    console.error('[Telegram auth] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TELEGRAM_AUTH_FAILED' }, { status: 500, headers: noStore })
  }
}
