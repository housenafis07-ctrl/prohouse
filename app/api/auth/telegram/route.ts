import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { telegramAuthEmail, telegramAuthPassword, validateTelegramInitData } from '@/app/lib/telegram-miniapp'
import { createHmac } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

const TELEGRAM_MISMATCH_COOKIE = 'rh_telegram_mismatch'

function telegramCookieSecret() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY || 'royalhouse-telegram-fallback'
}

function signTelegramMismatch(profileId: string, telegramUserId: string) {
  const payload = `${profileId}:${telegramUserId}`
  const signature = createHmac('sha256', telegramCookieSecret()).update(payload).digest('hex')
  return `${profileId}.${telegramUserId}.${signature}`
}

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
    const email = telegramAuthEmail(tgUser.id)
    const password = telegramAuthPassword(tgUser.id)
    const telegramDisplayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim()
    const displayName = telegramDisplayName || (tgUser.username ? `@${tgUser.username}` : `Telegram ${tgUser.id}`)

    // If the browser already has a RoyalHouse account, do not silently replace
    // it with another Telegram account. A fresh Telegram user can auto-register;
    // an already-authenticated phone user must explicitly link Telegram instead.
    const browserAuth = await createClient()
    const { data: { user: currentUser } } = await browserAuth.auth.getUser()

    const { data: existingLink, error: linkLookupError } = await admin
      .from('telegram_user_links')
      .select('profile_id,telegram_username,linked_at')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()
    if (linkLookupError) throw linkLookupError

    if (currentUser) {
      const metadataTelegramId = String(currentUser.user_metadata?.telegram_user_id || '')
      const sameCurrentAccount = existingLink?.profile_id === currentUser.id ||
        (metadataTelegramId && metadataTelegramId === telegramUserId)

      if (!sameCurrentAccount) {
        const response = NextResponse.json({
          error: 'TELEGRAM_ACCOUNT_MISMATCH',
          linkedProfileId: existingLink?.profile_id || null,
          currentProfileId: currentUser.id,
          canLinkCurrentAccount: !existingLink,
        }, {
          status: 409,
          headers: { 'Cache-Control': 'private, no-store' },
        })

        response.cookies.set(
          TELEGRAM_MISMATCH_COOKIE,
          signTelegramMismatch(currentUser.id, telegramUserId),
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 10 * 60,
          },
        )
        return response
      }
    }

    let profileId = existingLink?.profile_id || null
    let session: { access_token: string; refresh_token: string } | null = null

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

      if (!createUserError && createdUser?.user?.id) {
        profileId = createdUser.user.id
      } else if (createUserError && /already registered|already exists/i.test(createUserError.message)) {
        const authClient = await createClient()
        const signIn = await authClient.auth.signInWithPassword({ email, password })

        if (!signIn.error && signIn.data.user?.id && signIn.data.session) {
          profileId = signIn.data.user.id
          session = {
            access_token: signIn.data.session.access_token,
            refresh_token: signIn.data.session.refresh_token,
          }
        } else {
          let page = 1
          const perPage = 1000
          while (!profileId) {
            const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page, perPage })
            if (usersError) throw usersError
            const foundUser = usersPage.users.find(user => user.email?.toLowerCase() === email.toLowerCase())
            if (foundUser?.id) {
              profileId = foundUser.id
              break
            }
            if (usersPage.users.length < perPage) break
            page += 1
          }
          if (!profileId) throw signIn.error || new Error('TELEGRAM_USER_NOT_FOUND')
        }
      } else if (createUserError) {
        throw createUserError
      }
    }

    if (!profileId) {
      return NextResponse.json({ error: 'TELEGRAM_USER_CREATE_FAILED' }, { status: 500 })
    }

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
    } else {
      const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(profileId)
      if (authUserError) throw authUserError

      const authProvider = authUser.user?.user_metadata?.auth_provider
      const currentName = profile.full_name?.trim() || ''
      const isTelegramPlaceholder = authProvider === 'telegram' && (!currentName || /^admin$/i.test(currentName))

      if (isTelegramPlaceholder) {
        const { error: profileUpdateError } = await admin
          .from('profiles')
          .update({ full_name: displayName })
          .eq('id', profileId)
        if (profileUpdateError) throw profileUpdateError
      }
    }

    const { error: telegramLinkError } = await admin.from('telegram_user_links').upsert({
      profile_id: profileId,
      telegram_user_id: telegramUserId,
      chat_id: telegramUserId,
      telegram_username: tgUser.username || null,
      linked_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' })
    if (telegramLinkError) throw telegramLinkError

    if (!session) {
      const authClient = await createClient()
      let { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({ email, password })

      if (signInError) {
        const { error: passwordUpdateError } = await admin.auth.admin.updateUserById(profileId, { password })
        if (passwordUpdateError) throw passwordUpdateError

        const retry = await authClient.auth.signInWithPassword({ email, password })
        signInData = retry.data
        signInError = retry.error
      }

      if (signInError || !signInData.session) {
        throw signInError || new Error('TELEGRAM_SESSION_CREATE_FAILED')
      }

      session = {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      }
    }

    const response = NextResponse.json({
      ok: true,
      session,
      profile: {
        id: profileId,
        fullName: displayName,
        phone: profile?.phone || null,
        hasPhone: Boolean(profile?.phone),
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } })

    response.cookies.set('rh_telegram_identity', signTelegramIdentity(profileId, telegramUserId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    })
    response.cookies.set(TELEGRAM_MISMATCH_COOKIE, '', { path: '/', maxAge: 0 })

    return response
  } catch (error) {
    console.error('[Telegram auth] failed', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'TELEGRAM_AUTH_FAILED',
    }, { status: 500 })
  }
}
