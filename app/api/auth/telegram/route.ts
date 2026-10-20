import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { telegramAuthEmail, validateTelegramInitData } from '@/app/lib/telegram-miniapp'

const noStore = { 'Cache-Control': 'private, no-store' }

type TelegramProfile = {
  id: string
  full_name: string | null
  phone: string | null
}

function displayName(firstName?: string, lastName?: string, id?: number) {
  const value = [firstName, lastName].filter(Boolean).join(' ').trim()
  return value || `Telegram ${id ?? ''}`.trim()
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'INVALID_REQUEST_BODY' },
        { status: 400, headers: noStore },
      )
    }

    const rawInitData = (body as { initData?: unknown }).initData
    const initData = typeof rawInitData === 'string' ? rawInitData : ''
    const validated = validateTelegramInitData(initData)

    if (!validated) {
      return NextResponse.json(
        { error: 'INVALID_TELEGRAM_INIT_DATA' },
        { status: 401, headers: noStore },
      )
    }

    const tgUser = validated.user
    const telegramUserId = String(tgUser.id)
    const admin = serviceClient()

    // Telegram identity is the ONLY account resolver. No request cookie/session is read.
    const { data: existingLink, error: linkLookupError } = await admin
      .from('telegram_user_links')
      .select('profile_id, telegram_user_id, verified_at, verification_method')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()

    if (linkLookupError) throw linkLookupError

    let profileId: string
    let profile: TelegramProfile | null = null

    if (existingLink?.profile_id) {
      // Existing Telegram identity: resolve ONLY through telegram_user_id -> profile_id.
      profileId = existingLink.profile_id

      const { data: existingProfile, error: profileLookupError } = await admin
        .from('profiles')
        .select('id, full_name, phone')
        .eq('id', profileId)
        .maybeSingle()

      if (profileLookupError) throw profileLookupError
      if (!existingProfile) {
        return NextResponse.json(
          { error: 'TELEGRAM_PROFILE_NOT_FOUND' },
          { status: 409, headers: noStore },
        )
      }

      profile = existingProfile as TelegramProfile
    } else {
      // Brand-new Telegram identity: create a completely separate Auth/profile pair.
      const email = telegramAuthEmail(tgUser.id)
      const name = displayName(tgUser.first_name, tgUser.last_name, tgUser.id)

      const { data: createdAuth, error: createUserError } =
        await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            auth_provider: 'telegram',
            telegram_user_id: telegramUserId,
            telegram_username: tgUser.username ?? null,
            telegram_first_name: tgUser.first_name ?? null,
            telegram_last_name: tgUser.last_name ?? null,
          },
        })

      if (createUserError || !createdAuth.user) {
        // Recover only an exact previous Telegram identity. Never use a browser user.
        const { data: usersPage, error: usersError } =
          await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })

        if (usersError) throw usersError

        const oldTelegramUser = usersPage.users.find(
          user =>
            user.email?.toLowerCase() === email.toLowerCase() &&
            String(user.user_metadata?.telegram_user_id ?? '') === telegramUserId,
        )

        if (!oldTelegramUser) {
          throw createUserError ?? new Error('TELEGRAM_AUTH_USER_CREATE_FAILED')
        }

        profileId = oldTelegramUser.id
      } else {
        profileId = createdAuth.user.id
      }

      const { data: createdProfile, error: profileInsertError } = await admin
        .from('profiles')
        .insert({
          id: profileId,
          full_name: name,
          account_type: 'individual',
        })
        .select('id, full_name, phone')
        .single()

      if (profileInsertError) {
        const { data: existingProfile, error: existingProfileError } = await admin
          .from('profiles')
          .select('id, full_name, phone')
          .eq('id', profileId)
          .maybeSingle()

        if (existingProfileError) throw existingProfileError
        if (!existingProfile) throw profileInsertError

        profile = existingProfile as TelegramProfile
      } else {
        profile = createdProfile as TelegramProfile
      }

      const now = new Date().toISOString()

      const { data: createdLink, error: linkInsertError } = await admin
        .from('telegram_user_links')
        .insert({
          profile_id: profileId,
          telegram_user_id: telegramUserId,
          chat_id: telegramUserId,
          telegram_username: tgUser.username ?? null,
          linked_at: now,
          verified_at: now,
          verification_method: 'telegram_auto',
        })
        .select('profile_id')
        .single()

      if (linkInsertError || !createdLink) {
        // A concurrent request may have created this Telegram identity first.
        const { data: racedLink, error: raceLookupError } = await admin
          .from('telegram_user_links')
          .select('profile_id')
          .eq('telegram_user_id', telegramUserId)
          .maybeSingle()

        if (raceLookupError) throw raceLookupError
        if (!racedLink?.profile_id) {
          throw linkInsertError ?? new Error('TELEGRAM_LINK_CREATE_FAILED')
        }

        if (racedLink.profile_id !== profileId) {
          return NextResponse.json(
            { error: 'TELEGRAM_IDENTITY_ALREADY_LINKED' },
            { status: 409, headers: noStore },
          )
        }
      }
    }

    if (!profile) {
      const { data: finalProfile, error: finalProfileError } = await admin
        .from('profiles')
        .select('id, full_name, phone')
        .eq('id', profileId)
        .maybeSingle()

      if (finalProfileError) throw finalProfileError
      if (!finalProfile) {
        return NextResponse.json(
          { error: 'TELEGRAM_PROFILE_NOT_FOUND' },
          { status: 409, headers: noStore },
        )
      }

      profile = finalProfile as TelegramProfile
    }

    // Resolve the exact Auth user from the Telegram mapping/profile only.
    const { data: mappedAuthResult, error: mappedAuthError } =
      await admin.auth.admin.getUserById(profileId)

    if (mappedAuthError || !mappedAuthResult.user) {
      throw mappedAuthError ?? new Error('MAPPED_AUTH_USER_NOT_FOUND')
    }

    let mappedAuthUser = mappedAuthResult.user
    let authEmail = mappedAuthUser.email

    // Existing real email is never overwritten. Synthetic email is only for email-less Auth users.
    if (!authEmail) {
      authEmail = telegramAuthEmail(tgUser.id)

      const { error: emailUpdateError } = await admin.auth.admin.updateUserById(profileId, {
        email: authEmail,
        email_confirm: true,
      })

      if (emailUpdateError) throw emailUpdateError

      const { data: refreshedAuthResult, error: refreshedAuthError } =
        await admin.auth.admin.getUserById(profileId)

      if (refreshedAuthError || !refreshedAuthResult.user) {
        throw refreshedAuthError ?? new Error('AUTH_USER_REFRESH_FAILED')
      }

      mappedAuthUser = refreshedAuthResult.user
      authEmail = mappedAuthUser.email ?? authEmail
    }

    // Ensure metadata on the mapped Auth user, never on another/current-session user.
    const currentTelegramId = mappedAuthUser.user_metadata?.telegram_user_id

    if (String(currentTelegramId ?? '') !== telegramUserId) {
      const { error: metadataError } = await admin.auth.admin.updateUserById(profileId, {
        user_metadata: {
          ...(mappedAuthUser.user_metadata ?? {}),
          auth_provider: 'telegram',
          telegram_user_id: telegramUserId,
          telegram_username: tgUser.username ?? null,
          telegram_first_name: tgUser.first_name ?? null,
          telegram_last_name: tgUser.last_name ?? null,
        },
      })

      if (metadataError) throw metadataError
    }

    // Generate a fresh Supabase session for this exact Auth user; cookies are irrelevant.
    const { data: linkData, error: generateLinkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: authEmail,
    })

    if (generateLinkError || !linkData?.properties?.hashed_token) {
      throw generateLinkError ?? new Error('TELEGRAM_SESSION_TOKEN_CREATE_FAILED')
    }

    const { data: verifiedSession, error: verifyOtpError } = await admin.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token,
    })

    if (verifyOtpError || !verifiedSession.session) {
      throw verifyOtpError ?? new Error('TELEGRAM_SESSION_CREATE_FAILED')
    }

    const session = verifiedSession.session

    // Final isolation checks before anything reaches the browser.
    if (session.user.id !== profileId) {
      throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')
    }

    const sessionTelegramId = session.user.user_metadata?.telegram_user_id

    if (String(sessionTelegramId ?? '') !== telegramUserId) {
      throw new Error('TELEGRAM_IDENTITY_SESSION_MISMATCH')
    }

    return NextResponse.json(
      {
        ok: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
        },
        profile: {
          id: profileId,
          fullName: profile.full_name ?? displayName(tgUser.first_name, tgUser.last_name, tgUser.id),
          phone: profile.phone,
          hasPhone: Boolean(profile.phone),
        },
      },
      { headers: noStore },
    )
  } catch (error) {
    console.error('[Telegram auth] failed', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'TELEGRAM_AUTH_FAILED',
      },
      {
        status: 500,
        headers: noStore,
      },
    )
  }
}
