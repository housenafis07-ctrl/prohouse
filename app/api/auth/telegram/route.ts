import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'
import { telegramAuthEmail, telegramAuthPassword, validateTelegramInitData } from '@/app/lib/telegram-miniapp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const validated = validateTelegramInitData(initData)
    if (!validated) return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401 })

    const { user: tgUser } = validated
    const admin = serviceClient()
    const telegramUserId = String(tgUser.id)

    const { data: existingLink, error: linkLookupError } = await admin
      .from('telegram_user_links')
      .select('profile_id')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()
    if (linkLookupError) throw linkLookupError

    const sessionClient = await createClient()
    const { data: { user: currentUser } } = await sessionClient.auth.getUser()

    if (existingLink?.profile_id && currentUser?.id && existingLink.profile_id !== currentUser.id) {
      return NextResponse.json({ error: 'TELEGRAM_LINKED_TO_ANOTHER_PROFILE' }, { status: 409 })
    }

    let profileId = existingLink?.profile_id || currentUser?.id || null
    const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() || `Telegram ${tgUser.id}`
    const email = telegramAuthEmail(tgUser.id)
    const password = telegramAuthPassword(tgUser.id)

    if (!profileId) {
      const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          auth_provider: 'telegram',
          telegram_user_id: telegramUserId,
          telegram_username: tgUser.username || null,
          telegram_first_name: tgUser.first_name || null,
          telegram_last_name: tgUser.last_name || null,
        },
      })

      if (createUserError && !/already registered|already exists/i.test(createUserError.message)) throw createUserError

      if (createdUser?.user?.id) {
        profileId = createdUser.user.id
      } else {
        // Supabase's GoTrueAdminApi does not expose getUserByEmail in the JS client.
        // Resolve an existing deterministic Telegram account through the admin user list.
        // This path is only reached when createUser reports that the account already exists.
        let page = 1
        const perPage = 1000
        while (!profileId) {
          const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page, perPage })
          if (usersError) throw usersError
          const foundUser = usersPage.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
          if (foundUser?.id) {
            profileId = foundUser.id
            break
          }
          if (usersPage.users.length < perPage) break
          page += 1
        }
      }
    }

    if (!profileId) return NextResponse.json({ error: 'TELEGRAM_USER_CREATE_FAILED' }, { status: 500 })

    const { data: profile, error: profileLookupError } = await admin
      .from('profiles')
      .select('id,full_name,phone')
      .eq('id', profileId)
      .maybeSingle()
    if (profileLookupError) throw profileLookupError

    if (!profile) {
      const { error: profileInsertError } = await admin.from('profiles').insert({
        id: profileId,
        full_name: displayName,
        account_type: 'individual',
      })
      if (profileInsertError) throw profileInsertError
    } else if (!profile.full_name?.trim()) {
      const { error: profileUpdateError } = await admin.from('profiles').update({ full_name: displayName }).eq('id', profileId)
      if (profileUpdateError) throw profileUpdateError
    }

    const { error: telegramLinkError } = await admin.from('telegram_user_links').upsert({
      profile_id: profileId,
      telegram_user_id: telegramUserId,
      chat_id: telegramUserId,
      telegram_username: tgUser.username || null,
      linked_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' })
    if (telegramLinkError) throw telegramLinkError

    let session = null
    if (currentUser?.id !== profileId) {
      let { data: signInData, error: signInError } = await sessionClient.auth.signInWithPassword({ email, password })

      if (signInError) {
        const { error: passwordUpdateError } = await admin.auth.admin.updateUserById(profileId, { password })
        if (passwordUpdateError) throw signInError
        const retry = await sessionClient.auth.signInWithPassword({ email, password })
        signInData = retry.data
        signInError = retry.error
      }

      if (signInError) throw signInError
      session = signInData.session
    }

    return NextResponse.json({
      ok: true,
      session: session ? {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      } : null,
      profile: {
        id: profileId,
        fullName: displayName,
        phone: profile?.phone || null,
        hasPhone: Boolean(profile?.phone),
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[Telegram auth] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TELEGRAM_AUTH_FAILED' }, { status: 500 })
  }
}
