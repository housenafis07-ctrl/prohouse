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

    // IMPORTANT: the Telegram ID is the only identity resolver here.
    // We intentionally never call auth.getUser(), read request cookies, or use
    // a browser Supabase session to decide which RoyalHouse profile is used.
    const { data: existingLink, error: linkLookupError } = await admin
      .from('telegram_user_links')
      .select('profile_id,telegram_user_id,telegram_username,verified_at')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()

    if (linkLookupError) throw linkLookupError

    let profileId: string | null = existingLink?.profile_id ?? null
    let authUserId: string | null = null

    if (profileId) {
      // Existing mapping: never reassign it to another Auth user.
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

      // A mapping that explicitly belongs to another Telegram identity must
      // never be silently repaired/merged.
      if (linkedTelegramId && linkedTelegramId !== telegramUserId) {
        console.error('[Telegram auth] mapping/auth identity mismatch', {
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
            telegram_user_id: telegramUserId,
            telegram_username: tgUser.username || null,
            telegram_first_name: tgUser.first_name || null,
            telegram_last_name: tgUser.last_name || null,
          },
        })
        if (metadataError) throw metadataError
      }
    } else {
      // No Telegram mapping: create/recover ONLY the deterministic Telegram
      // Auth account for this telegram ID. No existing browser/session user is
      // ever attached here.
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

      if (createdUser?.user?.id) {
        authUserId = createdUser.user.id
        profileId = createdUser.user.id
      } else if (createUserError && isAlreadyRegisteredError(createUserError.message)) {
        // A previous attempt may have created the Auth user but failed before
        // creating the mapping. Recover only the deterministic Telegram email.
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
        // Avoid leaving an orphan Auth user when this was a fresh registration.
        if (!existingLink) {
          await admin.auth.admin.deleteUser(authUserId)
        }
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
        if (!profile) {
          await admin.from('profiles').delete().eq('id', profileId)
        }
        await admin.auth.admin.deleteUser(authUserId)
        throw telegramLinkError
      }
    } else {
      // Existing mapping is preserved. Only harmless Telegram display data is
      // refreshed; profile_id and telegram_user_id are never reassigned.
      const { error: linkUpdateError } = await admin
        .from('telegram_user_links')
        .update({
          telegram_username: tgUser.username || null,
        })
        .eq('telegram_user_id', telegramUserId)
        .eq('profile_id', profileId)

      if (linkUpdateError) throw linkUpdateError
    }

    // Generate a clean session for exactly authUserId. This does not inspect or
    // reuse any browser cookie/session and therefore cannot switch into account B.
    const { data: generatedLink, error: generateLinkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (generateLinkError || !generatedLink?.properties?.hashed_token) {
      throw generateLinkError || new Error('TELEGRAM_SESSION_LINK_FAILED')
    }

    const { data: verified, error: verifyError } = await admin.auth.verifyOtp({
      token_hash: generatedLink.properties.hashed_token,
      type: 'magiclink',
    })

    if (verifyError || !verified.session || !verified.user) {
      throw verifyError || new Error('TELEGRAM_SESSION_CREATE_FAILED')
    }

    if (verified.user.id !== authUserId) {
      console.error('[Telegram auth] CRITICAL session user mismatch', {
        telegramUserId,
        expectedAuthUserId: authUserId,
        actualSessionUserId: verified.user.id,
      })
      return NextResponse.json({ error: 'TELEGRAM_SESSION_IDENTITY_MISMATCH' }, { status: 500 })
    }

    const sessionTelegramId = verified.user.user_metadata?.telegram_user_id != null
      ? String(verified.user.user_metadata.telegram_user_id)
      : verified.user.user_metadata?.telegram_id != null
        ? String(verified.user.user_metadata.telegram_id)
        : null

    if (sessionTelegramId !== telegramUserId) {
      return NextResponse.json({ error: 'TELEGRAM_SESSION_TELEGRAM_ID_MISMATCH' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      session: {
        access_token: verified.session.access_token,
        refresh_token: verified.session.refresh_token,
      } satisfies TelegramAuthSession,
      profile: {
        id: profileId,
        fullName: displayName,
        phone: profile?.phone || null,
        hasPhone: Boolean(profile?.phone),
      },
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('[Telegram auth] failed', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'TELEGRAM_AUTH_FAILED',
    }, { status: 500 })
  }
}
