import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

async function getAccountProfileId() {
  const cookieStore = await cookies()
  return readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
}

export async function GET() {
  try {
    // RoyalHouse phone OTP uses its own account-session cookie, not necessarily
    // a Supabase Auth browser session. Use the same identity as /api/account/profile.
    const profileId = await getAccountProfileId()
    if (!profileId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

    const db = serviceClient()

    // telegram_user_links is the canonical record written when the bot confirms
    // the user's contact. Check it first so the UI reflects the successful link.
    const { data: link, error: linkError } = await db
      .from('telegram_user_links')
      .select('telegram_username,linked_at')
      .eq('profile_id', profileId)
      .maybeSingle()
    if (linkError) throw linkError

    if (link) {
      return NextResponse.json(
        { linked: true, username: link.telegram_username || null, linkedAt: link.linked_at || null },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } },
      )
    }

    // Compatibility fallback for older links stored only in telegram_bot_users.
    const { data: botUser, error: botUserError } = await db
      .from('telegram_bot_users')
      .select('telegram_user_id,username,profile_id')
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (botUserError) throw botUserError

    return NextResponse.json(
      { linked: Boolean(botUser), username: botUser?.username || null, linkedAt: null },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (error) {
    console.error('[Telegram link] Status check failed', error)
    return NextResponse.json({ error: 'TELEGRAM_LINK_STATUS_FAILED' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST() {
  try {
    // The dashboard's phone-based session identifies profiles.id directly.
    // Persist that profile ID in the token; the webhook needs it to verify the
    // phone number and create the canonical telegram_user_links row.
    const profileId = await getAccountProfileId()
    if (!profileId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const token = randomBytes(24).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const db = serviceClient()
    const { error } = await db.from('telegram_link_tokens').insert({
      token_hash: tokenHash,
      profile_id: profileId,
      auth_user_id: profileId,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    if (error) throw error

    return NextResponse.json(
      { url: `https://t.me/RoyalHouseUz_bot?start=link_${token}`, expiresInSeconds: 600 },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[Telegram link] Failed to create link', error)
    return NextResponse.json(
      { error: error instanceof Error ? `TELEGRAM_LINK_CREATE_FAILED: ${error.message}` : 'TELEGRAM_LINK_CREATE_FAILED' },
      { status: 500 },
    )
  }
}
