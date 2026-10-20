import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from '@/utils/admin/auth'
import { telegramAuthEmail, telegramAuthPassword, validateTelegramInitData } from '@/app/lib/telegram-miniapp'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : ''
    if (!accessToken) return NextResponse.json({ error: 'PHONE_SESSION_REQUIRED' }, { status: 401, headers: noStore })

    const validated = validateTelegramInitData(initData)
    if (!validated) return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401, headers: noStore })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !serviceRoleKey || !publishableKey) throw new Error('SUPABASE_SERVER_CONFIG_MISSING')

    const adminAuth = createSupabaseClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: phoneUser, error: phoneUserError } = await adminAuth.auth.getUser(accessToken)
    if (phoneUserError || !phoneUser.user) return NextResponse.json({ error: 'INVALID_PHONE_SESSION' }, { status: 401, headers: noStore })

    const profileId = phoneUser.user.id
    const admin = serviceClient()
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

    if (byTelegram?.profile_id && byTelegram.profile_id !== profileId) {
      return NextResponse.json({ error: 'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE' }, { status: 409, headers: noStore })
    }

    const { data: byProfile, error: profileLinkError } = await admin
      .from('telegram_user_links')
      .select('telegram_user_id')
      .eq('profile_id', profileId)
      .maybeSingle()
    if (profileLinkError) throw profileLinkError
    if (byProfile?.telegram_user_id && byProfile.telegram_user_id !== telegramUserId) {
      return NextResponse.json({ error: 'PROFILE_ALREADY_LINKED_TO_ANOTHER_TELEGRAM' }, { status: 409, headers: noStore })
    }

    const email = telegramAuthEmail(validated.user.id)
    const password = telegramAuthPassword(validated.user.id)
    const { error: authUpdateError } = await adminAuth.auth.admin.updateUserById(profileId, {
      email,
      email_confirm: true,
      password,
      user_metadata: {
        ...(phoneUser.user.user_metadata || {}),
        auth_provider: 'telegram',
        telegram_user_id: telegramUserId,
        telegram_username: validated.user.username || null,
        telegram_first_name: validated.user.first_name || null,
        telegram_last_name: validated.user.last_name || null,
      },
    })
    if (authUpdateError) throw authUpdateError

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

    const client = createSupabaseClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const signIn = await client.auth.signInWithPassword({ email, password })
    if (signIn.error || !signIn.data.session || signIn.data.user?.id !== profileId) {
      throw signIn.error || new Error('TELEGRAM_SESSION_CREATE_FAILED')
    }

    return NextResponse.json({
      ok: true,
      session: { access_token: signIn.data.session.access_token, refresh_token: signIn.data.session.refresh_token },
      profile: { id: profileId, phone: profile.phone, fullName: profile.full_name || '' },
    }, { headers: noStore })
  } catch (error) {
    console.error('[Telegram auth complete] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TELEGRAM_LINK_FAILED' }, { status: 500, headers: noStore })
  }
}
