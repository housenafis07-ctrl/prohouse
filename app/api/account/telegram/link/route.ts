import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

export async function GET() {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    const { data, error } = await serviceClient().from('telegram_user_links')
      .select('telegram_username,linked_at').eq('profile_id', user.id).maybeSingle()
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
