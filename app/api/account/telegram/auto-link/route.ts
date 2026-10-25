import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'
import { validateTelegramInitData } from '@/app/lib/telegram-miniapp'

export const runtime = 'nodejs'

/**
 * Links the Telegram identity currently opening the Mini App to the already
 * authenticated RoyalHouse profile. This is intentionally separate from the
 * Telegram-login endpoint: a phone-authenticated user keeps the same session
 * and Telegram becomes an additional identity/notification channel.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await createClient()
    const { data: { user: currentUser } } = await auth.auth.getUser()
    if (!currentUser) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    // Never replace an existing Telegram-authenticated session here.
    // This endpoint is only for a phone/email authenticated RoyalHouse profile.
    if (currentUser.user_metadata?.auth_provider === 'telegram') {
      return NextResponse.json({ ok: true, linked: true, alreadyTelegramSession: true })
    }

    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const validated = validateTelegramInitData(initData)
    if (!validated) return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401 })

    const telegramUserId = String(validated.user.id)
    const telegramUsername = validated.user.username || null
    const now = new Date().toISOString()
    const db = serviceClient()

    const { data: targetProfile, error: targetProfileError } = await db
      .from('profiles')
      .select('id,phone')
      .eq('id', currentUser.id)
      .maybeSingle()
    if (targetProfileError) throw targetProfileError
    if (!targetProfile) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 })

    const { data: existingLink, error: existingLinkError } = await db
      .from('telegram_user_links')
      .select('profile_id,chat_id,telegram_username')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()
    if (existingLinkError) throw existingLinkError

    // The Telegram ID is already attached to this profile. Repair only the
    // notification/bot registry metadata and keep the current session intact.
    if (existingLink?.profile_id === currentUser.id) {
      const { error: linkUpdateError } = await db
        .from('telegram_user_links')
        .update({ telegram_username: telegramUsername, linked_at: now })
        .eq('profile_id', currentUser.id)
      if (linkUpdateError) throw linkUpdateError

      const { error: botUpdateError } = await db
        .from('telegram_bot_users')
        .update({
          profile_id: currentUser.id,
          auth_user_id: currentUser.id,
          username: telegramUsername,
          is_active: true,
          blocked_at: null,
          last_interaction_at: now,
          updated_at: now,
        })
        .eq('telegram_user_id', telegramUserId)
      if (botUpdateError) throw botUpdateError

      return NextResponse.json({ ok: true, linked: true, merged: false })
    }

    // If this Telegram identity belongs to another RoyalHouse profile, only
    // merge when that profile is clearly a Telegram-only placeholder account.
    // A real profile with a phone number is never silently merged.
    if (existingLink?.profile_id && existingLink.profile_id !== currentUser.id) {
      const sourceProfileId = existingLink.profile_id
      const { data: sourceProfile, error: sourceProfileError } = await db
        .from('profiles')
        .select('id,phone')
        .eq('id', sourceProfileId)
        .maybeSingle()
      if (sourceProfileError) throw sourceProfileError

      const { data: sourceAuthUser, error: sourceAuthError } = await db.auth.admin.getUserById(sourceProfileId)
      if (sourceAuthError) throw sourceAuthError

      const sourceIsTelegramOnly =
        sourceProfile &&
        !sourceProfile.phone &&
        sourceAuthUser.user?.user_metadata?.auth_provider === 'telegram' &&
        String(sourceAuthUser.user.user_metadata?.telegram_user_id || '') === telegramUserId

      if (!sourceIsTelegramOnly) {
        return NextResponse.json({ error: 'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE' }, { status: 409 })
      }

      const { error: mergeError } = await db.rpc('merge_profile_accounts', {
        source_profile_id: sourceProfileId,
        target_profile_id: currentUser.id,
      })
      if (mergeError) throw mergeError

      const { error: targetLinkError } = await db
        .from('telegram_user_links')
        .upsert({
          profile_id: currentUser.id,
          telegram_user_id: telegramUserId,
          chat_id: existingLink.chat_id,
          telegram_username: telegramUsername,
          linked_at: now,
          verified_at: now,
          verification_method: 'telegram_mini_app_auto_link',
        }, { onConflict: 'profile_id' })
      if (targetLinkError) throw targetLinkError

      const { error: botUpdateError } = await db
        .from('telegram_bot_users')
        .upsert({
          telegram_user_id: telegramUserId,
          chat_id: existingLink.chat_id,
          profile_id: currentUser.id,
          auth_user_id: currentUser.id,
          username: telegramUsername,
          is_active: true,
          blocked_at: null,
          last_interaction_at: now,
          updated_at: now,
        }, { onConflict: 'telegram_user_id' })
      if (botUpdateError) throw botUpdateError

      // The source account has been migrated. Remove only the obsolete
      // Telegram-auth user; the current phone-auth account remains intact.
      const { error: deleteSourceError } = await db.auth.admin.deleteUser(sourceProfileId)
      if (deleteSourceError) throw deleteSourceError

      return NextResponse.json({ ok: true, linked: true, merged: true })
    }

    const { data: existingTargetLink, error: targetLinkLookupError } = await db
      .from('telegram_user_links')
      .select('telegram_user_id')
      .eq('profile_id', currentUser.id)
      .maybeSingle()
    if (targetLinkLookupError) throw targetLinkLookupError

    if (existingTargetLink?.telegram_user_id && existingTargetLink.telegram_user_id !== telegramUserId) {
      return NextResponse.json({ error: 'PROFILE_ALREADY_LINKED_TO_ANOTHER_TELEGRAM' }, { status: 409 })
    }

    const { error: linkError } = await db
      .from('telegram_user_links')
      .upsert({
        profile_id: currentUser.id,
        telegram_user_id: telegramUserId,
        chat_id: telegramUserId,
        telegram_username: telegramUsername,
        linked_at: now,
        verified_at: now,
        verification_method: 'telegram_mini_app_auto_link',
      }, { onConflict: 'profile_id' })
    if (linkError) throw linkError

    const { error: botUserError } = await db
      .from('telegram_bot_users')
      .upsert({
        telegram_user_id: telegramUserId,
        chat_id: telegramUserId,
        profile_id: currentUser.id,
        auth_user_id: currentUser.id,
        username: telegramUsername,
        is_active: true,
        blocked_at: null,
        last_interaction_at: now,
        updated_at: now,
      }, { onConflict: 'telegram_user_id' })
    if (botUserError) throw botUserError

    return NextResponse.json({ ok: true, linked: true, merged: false })
  } catch (error) {
    console.error('[Telegram auto-link] failed', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'TELEGRAM_AUTO_LINK_FAILED',
    }, { status: 500 })
  }
}
