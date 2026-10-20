import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { validateTelegramInitData, telegramAuthEmail, telegramAuthPassword } from '@/app/lib/telegram-miniapp'
import { createClient } from '@supabase/supabase-js'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : ''
    if (!accessToken) return NextResponse.json({ error: 'PHONE_SESSION_REQUIRED' }, { status: 401, headers: noStore })

    const validated = validateTelegramInitData(initData)
    if (!validated) return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401, headers: noStore })

    const admin = serviceClient()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_SERVER_CONFIG_MISSING')

    const authAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: authUser, error: authUserError } = await authAdmin.auth.getUser(accessToken)
    if (authUserError || !authUser.user) return NextResponse.json({ error: 'INVALID_PHONE_SESSION' }, { status: 401, headers: noStore })

    const profileId = authUser.user.id
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id,phone,full_name')
      .eq('id', profileId)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile?.phone) return NextResponse.json({ error: 'PHONE_NOT_VERIFIED' }, { status: 400, headers: noStore })

    const telegramUserId = String(validated.user.id)
    const { data: byTelegram, error: telegramLookupError } = await admin
      .from('telegram_user_links')
      .select('profile_id,verified_at')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()
    if (telegramLookupError) throw telegramLookupError

    if (byTelegram?.verified_at && byTelegram.profile_id !== profileId) {
      return NextResponse.json({ error: 'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE' }, { status: 409, headers: noStore })
    }

    const { data: byProfile, error: profileLinkError } = await admin
      .from('telegram_user_links')
      .select('telegram_user_id')
      .eq('profile_id', profileId)
      .maybeSingle()
    if (profileLinkError) throw profileLinkError
    if (byProfile && byProfile.telegram_user_id !== telegramUserId) {
      return NextResponse.json({ error: 'PROFILE_ALREADY_LINKED_TO_ANOTHER_TELEGRAM' }, { status: 409, headers: noStore })
    }

    const email = telegramAuthEmail(validated.user.id)
    const password = telegramAuthPassword(validated.user.id)
    const { data: existingAuthUsers, error: usersError } = await authAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (usersError) throw usersError

    const conflictingAuthUser = existingAuthUsers.users.find(
      user => user.email?.toLowerCase() === email.toLowerCase() && user.id !== profileId,
    )
    if (conflictingAuthUser) {
      return NextResponse.json({ error: 'TELEGRAM_AUTH_IDENTITY_CONFLICT' }, { status: 409, headers: noStore })
    }

    const { error: updateUserError } = await authAdmin.auth.admin.updateUserById(profileId, {
      email,
      email_confirm: true,
      password,
      user_metadata: {
        ...(authUser.user.user_metadata || {}),
        auth_provider: 'telegram',
        telegram_user_id: telegramUserId,
        telegram_username: validated.user.username || null,
        telegram_first_name: validated.user.first_name || null,
        telegram_last_name: validated.user.last_name || null,
      },
    })
    if (updateUserError) throw updateUserError

    const now = new Date().toISOString()
    const { error: linkError } = await admin.from('telegram_user_links').upsert({
      profile_id: profileId,
      telegram_user_id: telegramUserId,
      chat_id: telegramUserId,
      telegram_username: validated.user.username || null,
      linked_at: now,
      verified_at: now,
      verification_method: 'phone_otp',
    }, { onConflict: 'telegram_user_id' })
    if (linkError) throw linkError

    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!publishableKey) throw new Error('SUPABASE_PUBLISHABLE_KEY_MISSING')
    const client = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: sessionData, error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError || !sessionData.session) throw signInError || new Error('TELEGRAM_SESSION_CREATE_FAILED')

    return NextResponse.json({
      ok: true,
      session: { access_token: sessionData.session.access_token, refresh_token: sessionData.session.refresh_token },
      profile: { id: profileId, phone: profile.phone, fullName: profile.full_name || '' },
    }, { headers: noStore })
  } catch (error) {
    console.error('[Telegram auth complete] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TELEGRAM_LINK_FAILED' }, { status: 500, headers: noStore })
  }
}
