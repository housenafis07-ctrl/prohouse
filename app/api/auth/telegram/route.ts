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
    const admin = serviceClient()
    const telegramUserId = String(tgUser.id)

    const { data: existingLink, error: linkLookupError } = await admin
      .from('telegram_user_links')
      .select('profile_id,verified_at,verification_method')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()
    if (linkLookupError) throw linkLookupError

    // SECURITY: only an explicit, verified link may choose the Royalhouse account.
    // phone_otp proves phone ownership; account_link_token proves the user explicitly
    // initiated Telegram linking from the authenticated Royalhouse profile. Older
    // unverified/legacy mappings are never allowed to select an account.
    const trustedVerification = existingLink?.verification_method === 'phone_otp' || existingLink?.verification_method === 'account_link_token'
    if (!existingLink || !existingLink.profile_id || !existingLink.verified_at || !trustedVerification) {
      return NextResponse.json({
        error: 'TELEGRAM_PHONE_VERIFICATION_REQUIRED',
        telegramUserId,
        profileId: existingLink?.profile_id || null,
      }, { status: 428, headers: noStore })
    }

    const profileId = existingLink.profile_id
    const { data: profile, error: profileLookupError } = await admin
      .from('profiles')
      .select('id,full_name,phone')
      .eq('id', profileId)
      .maybeSingle()
    if (profileLookupError) throw profileLookupError
    if (!profile) return NextResponse.json({ error: 'TELEGRAM_PROFILE_NOT_FOUND' }, { status: 409, headers: noStore })

    const email = telegramAuthEmail(tgUser.id)
    const password = telegramAuthPassword(tgUser.id)
    const sessionClient = await createClient()
    const signIn = await sessionClient.auth.signInWithPassword({ email, password })

    if (signIn.error || !signIn.data.session) {
      const { error: passwordUpdateError } = await admin.auth.admin.updateUserById(profileId, { password })
      if (passwordUpdateError) throw passwordUpdateError
      const retry = await sessionClient.auth.signInWithPassword({ email, password })
      if (retry.error || !retry.data.session) throw retry.error || new Error('TELEGRAM_SESSION_CREATE_FAILED')
      return NextResponse.json({
        ok: true,
        session: { access_token: retry.data.session.access_token, refresh_token: retry.data.session.refresh_token },
        profile: { id: profileId, fullName: profile.full_name || '', phone: profile.phone || null, hasPhone: Boolean(profile.phone) },
      }, { headers: noStore })
    }

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
