import { randomBytes, createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

// Admin Telegram linking is tied to the authenticated admin identity, not a
// customer profile. Admin accounts are intentionally not required to have a
// row in public.profiles or a customer phone number.
export async function POST() {
  const { admin, error: authError } = await requireAdmin('listings.moderate')
  if (authError || !admin) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: authError === 'Unauthorized' ? 401 : 403 })
  }

  try {
    const db = serviceClient()
    const { data: existing, error: existingError } = await db
      .from('telegram_bot_users')
      .select('telegram_user_id,username')
      .eq('auth_user_id', admin.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing?.telegram_user_id) {
      return NextResponse.json({ linked: true, username: existing.username || null }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const token = randomBytes(24).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const { error: insertError } = await db.from('telegram_link_tokens').insert({
      token_hash: tokenHash,
      profile_id: null,
      auth_user_id: admin.user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    if (insertError) throw insertError

    return NextResponse.json(
      { url: `https://t.me/RoyalHouseUz_bot?start=link_${token}`, expiresInSeconds: 600 },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[admin/telegram/link] Failed to create link', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'TELEGRAM_LINK_CREATE_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
