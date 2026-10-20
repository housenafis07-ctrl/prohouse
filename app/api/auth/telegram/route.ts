import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { telegramAuthEmail, telegramAuthPassword, validateTelegramInitData } from '@/app/lib/telegram-miniapp'

export const runtime = 'nodejs'

type TelegramAuthSession = {
  access_token: string
  refresh_token: string
}

function isAlreadyRegisteredError(message: string) {
  return /already registered|already exists/i.test(message)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''

    if (!initData) {
      return NextResponse.json({ error: 'TELEGRAM_INIT_DATA_REQUIRED' }, { status: 400 })
    }

    const validated = validateTelegramInitData(initData)
    if (!validated) {
      return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401 })
    }

    const tgUser = validated.user
    const telegramUserId = String(tgUser.id)
    const admin = serviceClient()
    const email = telegramAuthEmail(tgUser.id)
    const password = telegramAuthPassword(tgUser.id)
    const telegramDisplayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim()
    const displayName = telegramDisplayName || (tgUser.username ? `@${tgUser.username}` : `Telegram ${tgUser.id}`)

    // Telegram identity is authoritative. No cookie, existing Supabase session,
    // request user_id, or other profile can participate in account selection.
    const { data: existingLink, error: linkLookupError } = await admin
      .from('telegram_user_links')
      .select('profile_id,telegram_user_id,telegram_username,verified_at')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()

    if (linkLookupError) throw linkLookupError

    let profileId: string | null = existingLink?.profile_id ?? null
    let authUserId: string | null = null
    let isNewAuthUser = false

    if (profileId) {
      // Existing mapping is immutable for identity resolution.
      const { data: mappedProfile, error: mappedProfileError } = await admin
        .from('profiles')
        .select('id,full_name,phone')
        .eq('id', profileId)
        .maybeSingle()

      if (mappedProfileError) throw mappedProfileError
      if (!mappedProfile) {
        return NextResponse.json({ error: 'TELEGRAM_PROFILE_MAPPING_BROKEN' }, { status: 409 })
      }

      authUserId = mappedProfile.id

      const { data: mappedAuth, error: mappedAuthError } = await admin.auth.admin.getUserById(authUserId)
      if (mappedAuthError) throw mappedAuthError
      if (!mappedAuth.user) {
        return NextResponse.json({ error: 'TELEGRAM_AUTH_USER_MISSING' }, { status: 409 })
      }

      const linkedTelegramId = mappedAuth.user.user_metadata?.telegram_user_id != null
        ? String(mappedAuth.user.user_metadata.telegram_user_id)
        : mappedAuth.user.user_metadata?.telegram_id != null
          ? String(mappedAuth.user.user_metadata.telegram_id)
          : null

      // Never silently move an existing Auth account to another Telegram user.
      if (linkedTelegramId && linkedTelegramId !== telegramUserId) {
        console.error('[STRICT AUTH] mapping/auth identity mismatch', {
          telegramUserId,
          profileId,
          authUserId,
          linkedTelegramId,
        })
        return NextResponse.json({ error: 'TELEGRAM_IDENTITY_MISMATCH' }, { status: 409 })
      }

      if (linkedTelegramId !== telegramUserId) {
        const { error: metadataError } = await admin.auth.admin.updateUserById(authUserId, {
          user_metadata: {
            ...mappedAuth.user.user_metadata,
            auth_provider: 'telegram',
            telegram_id: telegramUserId,
            telegram_user_id: telegramUserId,
            telegram_username: tgUser.username || null,
            telegram_first_name: tgUser.first_name || null,
            telegram_last_name: tgUser.last_name || null,
          },
        })
        if (metadataError) throw metadataError
      }
    } else {
      // No mapping means this Telegram identity is new. Create an Auth user
      // for this Telegram ID only; never attach an old browser user.
      const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          auth_provider: 'telegram',
          telegram_id: telegramUserId,
          telegram_user_id: telegramUserId,
          telegram_username: tgUser.username || null,
          telegram_first_name: tgUser.first_name || null,
          telegram_last_name: tgUser.last_name || null,
        },
      })

      if (createdUser?.user?.id) {
        authUserId = createdUser.user.id
        profileId = createdUser.user.id
        isNewAuthUser = true
      } else if (createUserError && isAlreadyRegisteredError(createUserError.message)) {
        // Previous interrupted registration may have left the deterministic
        // Auth user without its Telegram link. Recover that exact user only.
        let page = 1
        const perPage = 1000
        let recoveredUserId: string | null = null

        while (!recoveredUserId) {
          const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page, perPage })
          if (usersError) throw usersError

          const found = usersPage.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
          if (found?.id) {
            recoveredUserId = found.id
            break
          }

          if (usersPage.users.length < perPage) break
          page += 1
        }

        if (!recoveredUserId) throw createUserError

        const { data: recoveredAuth, error: recoveredAuthError } = await admin.auth.admin.getUserById(recoveredUserId)
        if (recoveredAuthError) throw recoveredAuthError
        if (!recoveredAuth.user) throw new Error('TELEGRAM_AUTH_USER_NOT_FOUND')

        const recoveredTelegramId = recoveredAuth.user.user_metadata?.telegram_user_id != null
          ? String(recoveredAuth.user.user_metadata.telegram_user_id)
          : recoveredAuth.user.user_metadata?.telegram_id != null
            ? String(recoveredAuth.user.user_metadata.telegram_id)
            : null

        if (recoveredTelegramId && recoveredTelegramId !== telegramUserId) {
          return NextResponse.json({ error: 'TELEGRAM_AUTH_USER_IDENTITY_MISMATCH' }, { status: 409 })
        }

        authUserId = recoveredUserId
        profileId = recoveredUserId

        const { error: metadataError } = await admin.auth.admin.updateUserById(recoveredUserId, {
          password,
          user_metadata: {
            ...recoveredAuth.user.user_metadata,
            auth_provider: 'telegram',
            telegram_id: telegramUserId,
            telegram_user_id: telegramUserId,
            telegram_username: tgUser.username || null,
            telegram_first_name: tgUser.first_name || null,
            telegram_last_name: tgUser.last_name || null,
          },
        })
        if (metadataError) throw metadataError
      } else if (createUserError) {
        throw createUserError
      }
    }

    if (!profileId || !authUserId || profileId !== authUserId) {
      return NextResponse.json({ error: 'TELEGRAM_PROFILE_AUTH_MAPPING_FAILED' }, { status: 500 })
    }

    // Create the profile only for the exact Auth user selected above.
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

      if (profileInsertError) {
        if (isNewAuthUser) await admin.auth.admin.deleteUser(authUserId)
        throw profileInsertError
      }
    } else if (!profile.full_name?.trim()) {
      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({ full_name: displayName })
        .eq('id', profileId)

      if (profileUpdateError) throw profileUpdateError
    }

    if (!existingLink) {
      const { error: telegramLinkError } = await admin.from('telegram_user_links').insert({
        profile_id: profileId,
        telegram_user_id: telegramUserId,
        chat_id: telegramUserId,
        telegram_username: tgUser.username || null,
        linked_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
      })

      if (telegramLinkError) {
        if (isNewAuthUser) {
          await admin.from('profiles').delete().eq('id', profileId)
          await admin.auth.admin.deleteUser(authUserId)
        }
        throw telegramLinkError
      }
    } else {
      // Existing identity link is preserved; only display metadata is refreshed.
      const { error: linkUpdateError } = await admin
        .from('telegram_user_links')
        .update({ telegram_username: tgUser.username || null })
        .eq('telegram_user_id', telegramUserId)
        .eq('profile_id', profileId)

      if (linkUpdateError) throw linkUpdateError
    }

    // Fresh session for exactly authUserId. No browser cookie/session is read.
    const authUserEmail = email
    const { data: generatedLink, error: generateLinkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: authUserEmail,
      options: {
        redirectTo: process.env.NEXT_PUBLIC_SITE_URL,
      },
    })

    if (generateLinkError) throw generateLinkError

    const hashedToken = generatedLink.properties?.hashed_token
    if (typeof hashedToken !== 'string' || hashedToken.length === 0) {
      throw new Error('AUTH_SESSION_TOKEN_NOT_GENERATED')
    }

    const { data: verifiedAuth, error: verifyOtpError } = await admin.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    })

    if (verifyOtpError) throw verifyOtpError
    if (!verifiedAuth.session || !verifiedAuth.user) throw new Error('TELEGRAM_SESSION_CREATE_FAILED')

    const session = verifiedAuth.session

    if (session.user.id !== authUserId) {
      console.error('[STRICT AUTH] CRITICAL SESSION USER MISMATCH', {
        telegram_id: telegramUserId,
        expected_auth_user_id: authUserId,
        actual_session_user_id: session.user.id,
      })
      return NextResponse.json({ error: 'SESSION_USER_MISMATCH' }, { status: 500 })
    }

    const sessionTelegramId = session.user.user_metadata?.telegram_user_id != null
      ? String(session.user.user_metadata.telegram_user_id)
      : session.user.user_metadata?.telegram_id != null
        ? String(session.user.user_metadata.telegram_id)
        : null

    if (sessionTelegramId !== telegramUserId) {
      console.error('[STRICT AUTH] CRITICAL SESSION TELEGRAM MISMATCH', {
        telegram_id: telegramUserId,
        session_telegram_id: sessionTelegramId,
        auth_user_id: session.user.id,
      })
      return NextResponse.json({ error: 'SESSION_TELEGRAM_ID_MISMATCH' }, { status: 500 })
    }

    console.log('[STRICT AUTH] CLEAN SESSION CREATED', {
      telegram_id: telegramUserId,
      profile_id: profileId,
      auth_user_id: session.user.id,
    })

    return NextResponse.json({
      ok: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      } satisfies TelegramAuthSession,
      profile: {
        id: profileId,
        fullName: displayName,
        phone: profile?.phone || null,
        hasPhone: Boolean(profile?.phone),
      },
    }, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('[STRICT AUTH] Telegram authentication failed', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'TELEGRAM_AUTH_FAILED',
    }, {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}
