import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

const TELEGRAM_IDENTITY_COOKIE = 'rh_telegram_identity'

function telegramCookieSecret() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY || 'royalhouse-telegram-fallback'
}

function signTelegramIdentity(profileId: string, telegramUserId: string) {
  const payload = `${profileId}:${telegramUserId}`
  const signature = createHmac('sha256', telegramCookieSecret()).update(payload).digest('hex')
  return `${profileId}.${telegramUserId}.${signature}`
}

function verifyTelegramIdentity(value: string | undefined) {
  if (!value) return null
  const parts = value.split('.')
  if (parts.length !== 3) return null
  const [profileId, telegramUserId, signature] = parts
  if (!profileId || !telegramUserId || !signature) return null
  const expected = createHmac('sha256', telegramCookieSecret()).update(`${profileId}:${telegramUserId}`).digest('hex')
  if (signature.length !== expected.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  } catch {
    return null
  }
  return { profileId, telegramUserId }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()

    const cookieIdentity = verifyTelegramIdentity(request.cookies.get(TELEGRAM_IDENTITY_COOKIE)?.value)
    const db = serviceClient()

    if (user) {
      const { data, error } = await db.from('telegram_user_links')
        .select('telegram_username,linked_at').eq('profile_id', user.id).maybeSingle()
      if (error) throw error

      // Telegram-first accounts are already linked even if the link row is still
      // being hydrated. The signed cookie is an immediate, server-created signal
      // from the successful Telegram auth response and removes the UI race.
      const isTelegramAuth = user.user_metadata?.auth_provider === 'telegram'
      const cookieMatchesUser = cookieIdentity?.profileId === user.id
      const username = data?.telegram_username || user.user_metadata?.telegram_username || null

      return NextResponse.json({
        linked: Boolean(data) || isTelegramAuth || cookieMatchesUser,
        username,
        linkedAt: data?.linked_at || null,
        source: isTelegramAuth ? 'telegram_auth' : cookieMatchesUser ? 'telegram_cookie' : 'linked_bot',
      }, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    // This path is only a startup-race fallback. Never expose account data from
    // the cookie; only return the boolean status and let the authenticated call
    // populate the username once the Supabase session is ready.
    if (cookieIdentity) {
      return NextResponse.json({ linked: true, username: null, linkedAt: null, source: 'telegram_cookie' }, {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    }

    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  } catch (error) {
    console.error('[Telegram link] Status check failed', error)
    return NextResponse.json({ error: 'TELEGRAM_LINK_STATUS_FAILED' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const token = randomBytes(24).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const db = serviceClient()
    const { error } = await db.from('telegram_link_tokens').insert({
      token_hash: tokenHash,
      profile_id: user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    if (error) throw error

    return NextResponse.json({
      url: `https://t.me/RoyalHouseUz_bot?start=link_${token}`,
      expiresInSeconds: 600,
    })
  } catch (error) {
    console.error('[Telegram link] Failed to create link', error)
    return NextResponse.json({ error: 'TELEGRAM_LINK_CREATE_FAILED' }, { status: 500 })
  }
}