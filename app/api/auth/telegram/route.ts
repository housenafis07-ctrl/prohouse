import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { validateTelegramInitData } from '@/app/lib/telegram-miniapp'

export const runtime = 'nodejs'

const SYNTHETIC_EMAIL_DOMAIN = 'royalhouse.internal'

function syntheticTelegramEmail(telegramId: string) {
  return `telegram_${telegramId}@${SYNTHETIC_EMAIL_DOMAIN}`
}

export async function POST(request: NextRequest) {
  try {
    /*
     * =========================================================
     * 1. TELEGRAM INIT DATA
     * =========================================================
     *
     * The request body is the ONLY identity input accepted here.
     * Cookies, existing Supabase sessions and request user IDs are
     * deliberately not read or used for account selection.
     */
    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''

    if (!initData) {
      return NextResponse.json(
        { error: 'TELEGRAM_INIT_DATA_REQUIRED' },
        { status: 400 }
      )
    }

    /*
     * Telegram HMAC + auth_date validation.
     */
    const validated = validateTelegramInitData(initData)

    if (!validated) {
      return NextResponse.json(
        { error: 'INVALID_TELEGRAM_INIT_DATA' },
        { status: 401 }
      )
    }

    const tgUser = validated.user
    const telegramId = String(tgUser.id)

    console.log('[STRICT AUTH] verified Telegram identity', {
      telegram_id: telegramId,
    })

    const admin = serviceClient()

    /*
     * =========================================================
     * 2. STRICT TELEGRAM -> PROFILE MAPPING
     * =========================================================
     *
     * RoyalHouse's real mapping table is telegram_user_links.
     * profile_id references profiles(id), and the current project
     * uses profiles.id as the Supabase Auth user ID.
     *
     * IMPORTANT:
     * There is NO lookup by browser cookie/session here.
     * There is NO fallback to another profile.
     */
    const {
      data: byTelegram,
      error: linkLookupError,
    } = await admin
      .from('telegram_user_links')
      .select('profile_id,telegram_user_id,telegram_username')
      .eq('telegram_user_id', telegramId)
      .maybeSingle()

    if (linkLookupError) {
      console.error('[STRICT AUTH] Telegram mapping lookup failed', linkLookupError)
      throw linkLookupError
    }

    /*
     * =========================================================
     * 3. NO MAPPING = NEW REGISTRATION FLOW
     * =========================================================
     *
     * No cookie fallback.
     * No existing browser user fallback.
     * No profile guessing.
     */
    if (!byTelegram) {
      console.log('[STRICT AUTH] no Telegram mapping', {
        telegram_id: telegramId,
      })

      return NextResponse.json(
        {
          requiresPhone: true,
          telegramId,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'private, no-store',
          },
        }
      )
    }

    /*
     * =========================================================
     * 4. STRICT TYPE GUARD
     * =========================================================
     */
    const profileId = byTelegram.profile_id

    if (
      typeof profileId !== 'string' ||
      profileId.length === 0
    ) {
      console.error('[STRICT AUTH] invalid profile_id in Telegram mapping', {
        telegram_id: telegramId,
        byTelegram,
      })

      return NextResponse.json(
        { error: 'INVALID_TELEGRAM_PROFILE_MAPPING' },
        { status: 500 }
      )
    }

    if (
      String(byTelegram.telegram_user_id) !== telegramId
    ) {
      console.error('[STRICT AUTH] mapping Telegram ID mismatch', {
        requested_telegram_id: telegramId,
        mapped_telegram_id: byTelegram.telegram_user_id,
        profile_id: profileId,
      })

      return NextResponse.json(
        { error: 'TELEGRAM_MAPPING_ID_MISMATCH' },
        { status: 409 }
      )
    }

    /*
     * =========================================================
     * 5. PROFILE LOOKUP
     * =========================================================
     *
     * profile_id is authoritative. We do not use a session user
     * to determine the profile.
     */
    const {
      data: byProfile,
      error: profileLookupError,
    } = await admin
      .from('profiles')
      .select('id,full_name,phone')
      .eq('id', profileId)
      .maybeSingle()

    if (profileLookupError) {
      console.error('[STRICT AUTH] profile lookup failed', profileLookupError)
      throw profileLookupError
    }

    if (!byProfile) {
      console.error('[STRICT AUTH] Telegram mapping points to missing profile', {
        telegram_id: telegramId,
        profile_id: profileId,
      })

      return NextResponse.json(
        { error: 'MAPPED_PROFILE_NOT_FOUND' },
        { status: 409 }
      )
    }

    /*
     * =========================================================
     * 6. AUTH USER ID
     * =========================================================
     *
     * In RoyalHouse, profiles.id is the Auth user UUID. This is
     * established by the existing telegram_user_links FK:
     * telegram_user_links.profile_id -> profiles.id.
     *
     * No cookie user ID is considered.
     */
    const authUserId = byProfile.id

    if (
      typeof authUserId !== 'string' ||
      authUserId.length === 0
    ) {
      console.error('[STRICT AUTH] auth_user_id is null/invalid', {
        telegram_id: telegramId,
        profile_id: profileId,
      })

      return NextResponse.json(
        { error: 'INVALID_AUTH_USER_MAPPING' },
        { status: 500 }
      )
    }

    /*
     * =========================================================
     * 7. LOAD EXACT AUTH USER
     * =========================================================
     */
    const {
      data: authUserResult,
      error: authUserLookupError,
    } = await admin.auth.admin.getUserById(authUserId)

    if (authUserLookupError) {
      console.error('[STRICT AUTH] Auth user lookup failed', authUserLookupError)
      throw authUserLookupError
    }

    const authUser = authUserResult.user

    if (!authUser) {
      console.error('[STRICT AUTH] mapped Auth user does not exist', {
        telegram_id: telegramId,
        profile_id: profileId,
        auth_user_id: authUserId,
      })

      return NextResponse.json(
        { error: 'MAPPED_AUTH_USER_NOT_FOUND' },
        { status: 409 }
      )
    }

    /*
     * =========================================================
     * 8. AUTH USER TELEGRAM ID CHECK
     * =========================================================
     *
     * Existing legacy users may only have telegram_user_id in
     * metadata. Absence is repaired below; an existing different
     * telegram_id, however, is a hard isolation failure.
     */
    const existingMetadataTelegramId =
      authUser.user_metadata?.telegram_id != null
        ? String(authUser.user_metadata.telegram_id)
        : null

    if (
      existingMetadataTelegramId &&
      existingMetadataTelegramId !== telegramId
    ) {
      console.error('[STRICT AUTH] CRITICAL Telegram/Auth mismatch', {
        telegram_id: telegramId,
        profile_id: profileId,
        auth_user_id: authUserId,
        auth_user_telegram_id: existingMetadataTelegramId,
      })

      return NextResponse.json(
        { error: 'AUTH_USER_BELONGS_TO_ANOTHER_TELEGRAM_ACCOUNT' },
        { status: 409 }
      )
    }

    /*
     * =========================================================
     * 9. EMAIL PREPARATION
     * =========================================================
     *
     * generateLink requires an email identity. For Auth users
     * without email, assign a deterministic synthetic email tied
     * exclusively to the verified Telegram ID.
     *
     * We do NOT create a new Auth user here.
     */
    let authEmail = authUser.email?.trim() || ''

    if (!authEmail) {
      authEmail = syntheticTelegramEmail(telegramId)

      console.log('[STRICT AUTH] assigning synthetic email', {
        telegram_id: telegramId,
        auth_user_id: authUserId,
        synthetic_email: authEmail,
      })

      const {
        data: updatedUserResult,
        error: emailUpdateError,
      } = await admin.auth.admin.updateUserById(authUserId, {
        email: authEmail,
        email_confirm: true,
      })

      if (emailUpdateError) {
        console.error('[STRICT AUTH] synthetic email update failed', emailUpdateError)
        throw emailUpdateError
      }

      if (!updatedUserResult.user?.email) {
        throw new Error('AUTH_USER_EMAIL_UPDATE_FAILED')
      }

      authEmail = updatedUserResult.user.email
    }

    /*
     * =========================================================
     * 10. REPAIR/SET TELEGRAM METADATA
     * =========================================================
     *
     * The client uses user_metadata.telegram_id for the final
     * identity check. Keep the legacy telegram_user_id as well.
     */
    const currentMetadata = authUser.user_metadata || {}
    const metadataTelegramUserId =
      currentMetadata.telegram_user_id != null
        ? String(currentMetadata.telegram_user_id)
        : null

    if (
      existingMetadataTelegramId !== telegramId ||
      metadataTelegramUserId !== telegramId
    ) {
      const {
        data: updatedAuthResult,
        error: metadataUpdateError,
      } = await admin.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          ...currentMetadata,
          auth_provider: 'telegram',
          telegram_id: telegramId,
          telegram_user_id: telegramId,
          telegram_username: tgUser.username || null,
          telegram_first_name: tgUser.first_name || null,
          telegram_last_name: tgUser.last_name || null,
        },
      })

      if (metadataUpdateError) {
        console.error('[STRICT AUTH] Telegram metadata update failed', metadataUpdateError)
        throw metadataUpdateError
      }

      if (!updatedAuthResult.user) {
        throw new Error('AUTH_METADATA_UPDATE_FAILED')
      }
    }

    /*
     * =========================================================
     * 11. GENERATE SESSION FOR EXACT MAPPED AUTH USER
     * =========================================================
     *
     * No signInWithPassword.
     * No browser session.
     * No cookie user.
     * No fallback profile.
     *
     * generateLink -> verifyOtp produces a fresh session for
     * the exact Auth user selected from the Telegram mapping.
     */
    const {
      data: generatedLink,
      error: generateLinkError,
    } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: authEmail,
      options: {
        redirectTo: process.env.NEXT_PUBLIC_SITE_URL,
      },
    })

    if (generateLinkError) {
      console.error('[STRICT AUTH] generateLink failed', generateLinkError)
      throw generateLinkError
    }

    const hashedToken = generatedLink.properties?.hashed_token

    if (
      typeof hashedToken !== 'string' ||
      hashedToken.length === 0
    ) {
      console.error('[STRICT AUTH] generateLink returned no hashed_token')
      throw new Error('AUTH_SESSION_TOKEN_NOT_GENERATED')
    }

    const {
      data: verifiedAuth,
      error: verifyOtpError,
    } = await admin.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    })

    if (verifyOtpError) {
      console.error('[STRICT AUTH] verifyOtp failed', verifyOtpError)
      throw verifyOtpError
    }

    const session = verifiedAuth.session

    if (!session) {
      throw new Error('TELEGRAM_SESSION_CREATE_FAILED')
    }

    /*
     * =========================================================
     * 12. FINAL SERVER-SIDE ISOLATION CHECKS
     * =========================================================
     */
    if (session.user.id !== authUserId) {
      console.error('[STRICT AUTH] CRITICAL SESSION USER MISMATCH', {
        telegram_id: telegramId,
        expected_auth_user_id: authUserId,
        actual_session_user_id: session.user.id,
      })

      return NextResponse.json(
        { error: 'SESSION_USER_MISMATCH' },
        { status: 500 }
      )
    }

    const sessionTelegramId =
      session.user.user_metadata?.telegram_id != null
        ? String(session.user.user_metadata.telegram_id)
        : null

    if (
      !sessionTelegramId ||
      sessionTelegramId !== telegramId
    ) {
      console.error('[STRICT AUTH] CRITICAL SESSION TELEGRAM MISMATCH', {
        telegram_id: telegramId,
        session_telegram_id: sessionTelegramId,
        auth_user_id: session.user.id,
      })

      return NextResponse.json(
        { error: 'SESSION_TELEGRAM_ID_MISMATCH' },
        { status: 500 }
      )
    }

    console.log('[STRICT AUTH] CLEAN SESSION CREATED', {
      telegram_id: telegramId,
      profile_id: profileId,
      auth_user_id: session.user.id,
    })

    return NextResponse.json(
      {
        ok: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
        profile: {
          id: profileId,
          fullName: byProfile.full_name || null,
          phone: byProfile.phone || null,
          hasPhone: Boolean(byProfile.phone),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    )
  } catch (error) {
    console.error('[STRICT AUTH] Telegram authentication failed', error)

    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'TELEGRAM_AUTH_FAILED',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    )
  }
}
