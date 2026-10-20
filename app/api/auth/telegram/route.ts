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

    // A Telegram identity is globally unique. Never let a Telegram Mini App
    // silently replace an already-authenticated RoyalHouse phone/email account.
    // If this Telegram identity is already linked elsewhere, keep the current
    // session intact and require explicit linking instead of switching profiles.
    if (existingLink && currentUser && existingLink.profile_id !== currentUser.id) {
      return NextResponse.json({
        error: 'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE',
        requiresLinking: true,
      }, { status: 409 })
    }

    // If a user is already authenticated with a phone/email account but this
    // Telegram identity has never been linked, do not silently bind it to the
    // current account. The user must explicitly start the Telegram linking flow.
    if (!existingLink && currentUser) {
      return NextResponse.json({
        error: 'TELEGRAM_LINK_REQUIRED',
        requiresLinking: true,
      }, { status: 409 })
    }

    let profileId = existingLink?.profile_id || null
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
        const { data: foundUser, error: foundUserError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        if (foundUserError) throw foundUserError
        profileId = foundUser.users.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id || null
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

    // telegram_user_id has a UNIQUE constraint. Use it as the conflict key so
    // the same Telegram identity can never be attached to a second profile.
    const { error: telegramLinkError } = await admin.from('telegram_user_links').upsert({
      profile_id: profileId,
      telegram_user_id: telegramUserId,
      chat_id: telegramUserId,
      telegram_username: tgUser.username || null,
      linked_at: new Date().toISOString(),
    }, { onConflict: 'telegram_user_id' })
    if (telegramLinkError) throw telegramLinkError

    const { error: signInError } = await sessionClient.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError

    return NextResponse.json({
      ok: true,
      profile: {
        id: profileId,
        fullName: displayName,
        phone: profile?.phone || null,
        hasPhone: Boolean(profile?.phone),
      },
    })
  } catch (error) {
    console.error('[Telegram auth] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TELEGRAM_AUTH_FAILED' }, { status: 500 })
  }
}
