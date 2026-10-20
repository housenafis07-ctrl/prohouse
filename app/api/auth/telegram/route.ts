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

    // Telegram identity is the source of truth inside the Mini App.
    // Never use the current browser/Supabase user to select the profile.
    // A stale phone-authenticated session may belong to another person.
    const { data: existingLink, error: linkLookupError } = await admin
      .from('telegram_user_links')
      .select('profile_id')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()
    if (linkLookupError) throw linkLookupError

    let profileId = existingLink?.profile_id || null
    const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() || `Telegram ${tgUser.id}`
    const email = telegramAuthEmail(tgUser.id)
    const password = telegramAuthPassword(tgUser.id)

    // No Telegram link means this is a new Telegram identity. Do NOT attach it
    // to whatever Supabase account happens to be in the browser. That would be
    // an account-confusion vulnerability. Create a fresh canonical account.
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

    // Race-safe final check: a Telegram ID can never be silently moved to
    // another profile, even if two login requests arrive at the same time.
    const { data: linkAfterLookup, error: finalLinkLookupError } = await admin
      .from('telegram_user_links')
      .select('profile_id')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()
    if (finalLinkLookupError) throw finalLinkLookupError
    if (linkAfterLookup && linkAfterLookup.profile_id !== profileId) {
      return NextResponse.json({
        error: 'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE',
        requiresLinking: true,
      }, { status: 409 })
    }

    const { error: telegramLinkError } = await admin.from('telegram_user_links').upsert({
      profile_id: profileId,
      telegram_user_id: telegramUserId,
      chat_id: telegramUserId,
      telegram_username: tgUser.username || null,
      linked_at: new Date().toISOString(),
    }, { onConflict: 'telegram_user_id' })
    if (telegramLinkError) throw telegramLinkError

    // Create the session strictly for the canonical Telegram profile.
    const sessionClient = await createClient()
    const signIn = await sessionClient.auth.signInWithPassword({ email, password })
    if (signIn.error || !signIn.data.session) {
      const { error: passwordUpdateError } = await admin.auth.admin.updateUserById(profileId, { password })
      if (passwordUpdateError) throw passwordUpdateError

      const retry = await sessionClient.auth.signInWithPassword({ email, password })
      if (retry.error || !retry.data.session) throw retry.error || new Error('TELEGRAM_SESSION_CREATE_FAILED')

      return NextResponse.json({
        ok: true,
        session: {
          access_token: retry.data.session.access_token,
          refresh_token: retry.data.session.refresh_token,
        },
        profile: {
          id: profileId,
          fullName: displayName,
          phone: profile?.phone || null,
          hasPhone: Boolean(profile?.phone),
        },
      }, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    return NextResponse.json({
      ok: true,
      session: {
        access_token: signIn.data.session.access_token,
        refresh_token: signIn.data.session.refresh_token,
      },
      profile: {
        id: profileId,
        fullName: displayName,
        phone: profile?.phone || null,
        hasPhone: Boolean(profile?.phone),
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[Telegram auth] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TELEGRAM_AUTH_FAILED' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
