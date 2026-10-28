import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

export async function GET() {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    const db = serviceClient()

    // The bot can complete the link before auth_user_id is backfilled. In that
    // case the old check returned linked=false even though Telegram said "linked".
    const { data: botUser, error: botUserError } = await db
      .from('telegram_bot_users')
      .select('telegram_user_id,username,linked_at,profile_id,auth_user_id')
      .eq('is_active', true)
      .or(`auth_user_id.eq.${user.id},profile_id.eq.${user.id}`)
      .order('linked_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    if (botUserError) throw botUserError

    if (botUser) {
      return NextResponse.json({ linked: true, username: botUser.username || null, linkedAt: botUser.linked_at || null })
    }

    const { data, error } = await db
      .from('telegram_user_links')
      .select('telegram_username,linked_at')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ linked: Boolean(data), username: data?.telegram_username || null, linkedAt: data?.linked_at || null })
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
      auth_user_id: user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    if (error) throw error
    return NextResponse.json({ url: `https://t.me/RoyalHouseUz_bot?start=link_${token}`, expiresInSeconds: 600 })
  } catch (error) {
    console.error('[Telegram link] Failed to create link', error)
    return NextResponse.json({ error: error instanceof Error ? `TELEGRAM_LINK_CREATE_FAILED: ${error.message}` : 'TELEGRAM_LINK_CREATE_FAILED' }, { status: 500 })
  }
}