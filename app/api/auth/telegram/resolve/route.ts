import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { telegramAuthEmail, telegramAuthPassword, validateTelegramInitData } from '@/app/lib/telegram-miniapp'
import { createClient } from '@supabase/supabase-js'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const validated = validateTelegramInitData(initData)
    if (!validated) return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401, headers: noStore })

    const admin = serviceClient()
    const telegramUserId = String(validated.user.id)
    const { data: link, error: linkError } = await admin.from('telegram_user_links').select('profile_id').eq('telegram_user_id', telegramUserId).maybeSingle()
    if (linkError) throw linkError
    if (!link?.profile_id) return NextResponse.json({ error: 'TELEGRAM_PHONE_VERIFICATION_REQUIRED' }, { status: 428, headers: noStore })

    const { data: profile, error: profileError } = await admin.from('profiles').select('id,full_name,phone').eq('id', link.profile_id).maybeSingle()
    if (profileError) throw profileError
    if (!profile) return NextResponse.json({ error: 'TELEGRAM_PROFILE_NOT_FOUND' }, { status: 409, headers: noStore })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !serviceRoleKey || !publishableKey) throw new Error('SUPABASE_SERVER_CONFIG_MISSING')

    const authAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const email = telegramAuthEmail(validated.user.id)
    const password = telegramAuthPassword(validated.user.id)
    const { data: users, error: usersError } = await authAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (usersError) throw usersError

    const conflict = users.users.find(user => user.email?.toLowerCase() === email.toLowerCase() && user.id !== profile.id)
    if (conflict) {
      const conflictTelegramId = String(conflict.user_metadata?.telegram_user_id || '')
      if (conflict.user_metadata?.auth_provider !== 'telegram' || conflictTelegramId !== telegramUserId) {
        return NextResponse.json({ error: 'TELEGRAM_AUTH_IDENTITY_CONFLICT' }, { status: 409, headers: noStore })
      }
      const detachedEmail = `legacy-telegram-${telegramUserId}-${Date.now()}@auth.royalhouse.uz`
      const { error } = await authAdmin.auth.admin.updateUserById(conflict.id, { email: detachedEmail, email_confirm: true, password: crypto.randomUUID() + crypto.randomUUID(), user_metadata: { ...(conflict.user_metadata || {}), auth_provider: 'legacy_telegram_detached', telegram_identity_detached_at: new Date().toISOString() } })
      if (error) throw error
    }

    const { error: profileAuthError } = await authAdmin.auth.admin.updateUserById(profile.id, {
      email,
      email_confirm: true,
      password,
      user_metadata: { auth_provider: 'telegram', telegram_user_id: telegramUserId, telegram_username: validated.user.username || null, telegram_first_name: validated.user.first_name || null, telegram_last_name: validated.user.last_name || null },
    })
    if (profileAuthError) throw profileAuthError

    const client = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: sessionData, error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError || !sessionData.session || sessionData.user?.id !== profile.id) throw signInError || new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')

    return NextResponse.json({ ok: true, session: { access_token: sessionData.session.access_token, refresh_token: sessionData.session.refresh_token }, profile: { id: profile.id, fullName: profile.full_name || '', phone: profile.phone || null, hasPhone: Boolean(profile.phone) } }, { headers: noStore })
  } catch (error) {
    console.error('[Telegram auth resolve] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TELEGRAM_AUTH_FAILED' }, { status: 500, headers: noStore })
  }
}
