import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'
import { validateTelegramInitData } from '@/app/lib/telegram-miniapp'

export const runtime = 'nodejs'

const CONFLICT_ERRORS = new Set([
  'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE',
  'PROFILE_ALREADY_LINKED_TO_ANOTHER_TELEGRAM',
])

/**
 * Atomically links the Telegram identity opening the Mini App to the
 * already authenticated, phone-verified RoyalHouse profile.
 * No account merging, deletion, or Telegram-only authentication is performed.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await createClient()
    const { data: { user: currentUser } } = await auth.auth.getUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    }

    // Legacy Telegram-authenticated sessions are not eligible for this flow.
    if (currentUser.user_metadata?.auth_provider === 'telegram') {
      return NextResponse.json({ error: 'PHONE_AUTH_REQUIRED' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const validated = validateTelegramInitData(initData, 10 * 60)
    if (!validated) {
      return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401 })
    }

    const telegramUserId = String(validated.user.id)
    const telegramUsername = validated.user.username || null
    const linkedAt = new Date().toISOString()
    const db = serviceClient()

    const { error } = await db.rpc('link_telegram_identity', {
      p_profile_id: currentUser.id,
      p_telegram_user_id: telegramUserId,
      p_chat_id: telegramUserId,
      p_telegram_username: telegramUsername,
      p_linked_at: linkedAt,
    })

    if (error) {
      const message = error.message || 'TELEGRAM_AUTO_LINK_FAILED'
      if (CONFLICT_ERRORS.has(message) || error.code === '23505') {
        return NextResponse.json({ error: message }, { status: 409 })
      }
      if (message === 'PROFILE_NOT_FOUND') {
        return NextResponse.json({ error: message }, { status: 404 })
      }
      if (message === 'PHONE_VERIFICATION_REQUIRED') {
        return NextResponse.json({ error: message }, { status: 403 })
      }
      throw error
    }

    return NextResponse.json({ ok: true, linked: true, merged: false })
  } catch (error) {
    console.error('[Telegram auto-link] failed', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'TELEGRAM_AUTO_LINK_FAILED',
    }, { status: 500 })
  }
}
