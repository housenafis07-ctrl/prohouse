import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { telegramAuthEmail, telegramAuthPassword, validateTelegramInitData } from '@/app/lib/telegram-miniapp'

export const runtime = 'nodejs'

type TelegramAuthSession = {
  access_token: string
  refresh_token: string
}

type TelegramMetadata = {
  telegram_user_id?: unknown
  telegram_id?: unknown
}

function normalizeTelegramId(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

function isAlreadyRegisteredError(message: string): boolean {
  return /already registered|already exists/i.test(message)
}

function getMetadataTelegramId(metadata: TelegramMetadata | null | undefined): string | null {
  return normalizeTelegramId(metadata?.telegram_user_id) ?? normalizeTelegramId(metadata?.telegram_id)
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''

    if (!initData) return jsonError('TELEGRAM_INIT_DATA_REQUIRED', 400)

    const validated = validateTelegramInitData(initData)
    if (!validated) return jsonError('INVALID_TELEGRAM_INIT_DATA', 401)

    const tgUser = validated.user
    const telegramId = normalizeTelegramId(tgUser.id)
    if (!telegramId) return jsonError('TELEGRAM_ID_INVALID', 400)

    const admin = serviceClient()
    const syntheticEmail = telegramAuthEmail(tgUser.id)
    const telegramPassword = telegramAuthPassword(tgUser.id)
    const displayName =
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() ||
      (tgUser.username ? `@${tgUser.username}` : `Telegram ${telegramId}`)

    // Telegram initData is the only identity input. No cookie, existing
    // browser session, request user_id, or client-supplied profile can choose
    // the account.
    const { data: existingLink, error: linkLookupError } = await admin
      .from('telegram_user_links')
      .select('profile_id,telegram_user_id,telegram_username,verified_at')
      .eq('telegram_user_id', telegramId)
      .maybeSingle()

    if (linkLookupError) throw linkLookupError

    let profileId: string | null = existingLink?.profile_id ?? null
    let authUserId: string | null = null
    let authEmail: string | null = null
    let isNewAuthUser = false

    if (profileId) {
      if (typeof profileId !== 'string' || profileId.trim() === '') {
        return jsonError('INVALID_TELEGRAM_PROFILE_MAPPING', 409)
      }

      const { data: mappedProfile, error: profileError } = await admin
        .from('profiles')
        .select('id,full_name,phone')
        .eq('id', profileId)
        .maybeSingle()

      if (profileError) throw profileError
      if (!mappedProfile) return jsonError('TELEGRAM_PROFILE_MAPPING_BROKEN', 409)

      // RoyalHouse profiles.id is the Supabase Auth user ID. Never replace it
      // with anything supplied by the browser.
      authUserId = mappedProfile.id
      if (!authUserId) return jsonError('TELEGRAM_AUTH_USER_MAPPING_MISSING', 409)

      const { data: mappedAuth, error: authLookupError } = await admin.auth.admin.getUserById(authUserId)
      if (authLookupError) throw authLookupError
      if (!mappedAuth.user) return jsonError('TELEGRAM_AUTH_USER_MISSING', 409)

      const mappedTelegramId = getMetadataTelegramId(mappedAuth.user.user_metadata)
      if (mappedTelegramId && mappedTelegramId !== telegramId) {
        console.error('[STRICT AUTH] mapping/auth identity mismatch', {
          telegram_id: telegramId,
          profile_id: profileId,
          auth_user_id: authUserId,
          mapped_telegram_id: mappedTelegramId,
        })
        return jsonError('TELEGRAM_IDENTITY_MISMATCH', 409)
      }

      const updatedMetadata = {
        ...mappedAuth.user.user_metadata,
        auth_provider: 'telegram',
        telegram_id: telegramId,
        telegram_user_id: telegramId,
        telegram_username: tgUser.username || null,
        telegram_first_name: tgUser.first_name || null,
        telegram_last_name: tgUser.last_name || null,
      }

      const { error: metadataError } = await admin.auth.admin.updateUserById(authUserId, {
        user_metadata: updatedMetadata,
      })
      if (metadataError) throw metadataError

      // generateLink resolves a user by email. Therefore use the exact mapped
      // Auth user's email; synthetic email is only for users without email.
      authEmail = typeof mappedAuth.user.email === 'string' && mappedAuth.user.email.trim()
        ? mappedAuth.user.email.trim()
        : syntheticEmail

      if (!mappedAuth.user.email?.trim()) {
        const { error: emailError } = await admin.auth.admin.updateUserById(authUserId, {
          email: syntheticEmail,
          email_confirm: true,
        })
        if (emailError) throw emailError
      }
    } else {
      // No mapping = genuinely new Telegram identity. Create a brand-new Auth
      // user; never attach the browser's old Supabase user.
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password: telegramPassword,
        email_confirm: true,
        user_metadata: {
          auth_provider: 'telegram',
          telegram_id: telegramId,
          telegram_user_id: telegramId,
          telegram_username: tgUser.username || null,
          telegram_first_name: tgUser.first_name || null,
          telegram_last_name: tgUser.last_name || null,
        },
      })

      if (created.user?.id) {
        authUserId = created.user.id
        profileId = created.user.id
        authEmail = syntheticEmail
        isNewAuthUser = true
      } else if (createError && isAlreadyRegisteredError(createError.message)) {
        // Recover only the deterministic Telegram account. The email is
        // derived from the verified Telegram ID, so no browser account can be
        // selected here.
        let page = 1
        const perPage = 1000
        let recovered: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null = null

        while (!recovered) {
          const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page, perPage })
          if (usersError) throw usersError

          const found = usersPage.users.find((user) => user.email?.toLowerCase() === syntheticEmail.toLowerCase())
          if (found) {
            recovered = found
            break
          }

          if (usersPage.users.length < perPage) break
          page += 1
        }

        if (!recovered) throw createError

        const recoveredTelegramId = getMetadataTelegramId(recovered.user_metadata)
        if (recoveredTelegramId && recoveredTelegramId !== telegramId) {
          return jsonError('TELEGRAM_AUTH_USER_IDENTITY_MISMATCH', 409)
        }

        authUserId = recovered.id
        profileId = recovered.id
        authEmail = recovered.email?.trim() || syntheticEmail

        const { error: recoveryMetadataError } = await admin.auth.admin.updateUserById(recovered.id, {
          password: telegramPassword,
          email: recovered.email?.trim() || syntheticEmail,
          email_confirm: true,
          user_metadata: {
            ...(recovered.user_metadata || {}),
            auth_provider: 'telegram',
            telegram_id: telegramId,
            telegram_user_id: telegramId,
            telegram_username: tgUser.username || null,
            telegram_first_name: tgUser.first_name || null,
            telegram_last_name: tgUser.last_name || null,
          },
        })
        if (recoveryMetadataError) throw recoveryMetadataError
      } else if (createError) {
        throw createError
      }
    }

    if (!authUserId || !profileId || profileId !== authUserId || !authEmail) {
      return jsonError('TELEGRAM_PROFILE_AUTH_MAPPING_FAILED', 500)
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
      const { error: linkInsertError } = await admin.from('telegram_user_links').insert({
        profile_id: profileId,
        telegram_user_id: telegramId,
        chat_id: telegramId,
        telegram_username: tgUser.username || null,
        linked_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
      })

      if (linkInsertError) {
        if (isNewAuthUser) {
          await admin.from('profiles').delete().eq('id', profileId)
          await admin.auth.admin.deleteUser(authUserId)
        }
        throw linkInsertError
      }
    } else {
      const { error: linkUpdateError } = await admin
        .from('telegram_user_links')
        .update({ telegram_username: tgUser.username || null })
        .eq('telegram_user_id', telegramId)
        .eq('profile_id', profileId)

      if (linkUpdateError) throw linkUpdateError
    }

    // Create a fresh session for exactly authUserId. Browser cookies/session
    // are never inspected or reused here.
    const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: authEmail,
      options: { redirectTo: process.env.NEXT_PUBLIC_SITE_URL },
    })

    if (generateError) throw generateError

    const hashedToken = generated.properties?.hashed_token
    if (typeof hashedToken !== 'string' || hashedToken.length === 0) {
      throw new Error('AUTH_SESSION_TOKEN_NOT_GENERATED')
    }

    const { data: verified, error: verifyError } = await admin.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    })

    if (verifyError) throw verifyError
    if (!verified.session || !verified.user) throw new Error('TELEGRAM_SESSION_CREATE_FAILED')

    const session = verified.session
    const sessionTelegramId = getMetadataTelegramId(session.user.user_metadata)

    if (session.user.id !== authUserId) {
      console.error('[STRICT AUTH] CRITICAL SESSION USER MISMATCH', {
        telegram_id: telegramId,
        expected_auth_user_id: authUserId,
        actual_session_user_id: session.user.id,
      })
      return jsonError('SESSION_USER_MISMATCH', 500)
    }

    if (sessionTelegramId !== telegramId) {
      console.error('[STRICT AUTH] CRITICAL SESSION TELEGRAM MISMATCH', {
        telegram_id: telegramId,
        session_telegram_id: sessionTelegramId,
        auth_user_id: session.user.id,
      })
      return jsonError('SESSION_TELEGRAM_ID_MISMATCH', 500)
    }

    console.log('[STRICT AUTH] CLEAN SESSION CREATED', {
      telegram_id: telegramId,
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
