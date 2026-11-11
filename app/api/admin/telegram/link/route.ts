import { randomBytes, createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

// Admin pages use the verified admin session, not the customer account-session
// endpoint. The admin's user ID must also identify a phone-backed RoyalHouse
// profile because Telegram linking is attached to profiles.id.
export async function POST() {
  const { admin, error: authError } = await requireAdmin('listings.moderate')
  if (authError || !admin) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: authError === 'Unauthorized' ? 401 : 403 })
  }

  try {
    const db = serviceClient()
    const { data: profile, error: profileError } = await db
      .from('profiles').select('id,phone').eq('id', admin.user.id).maybeSingle()
    if (profileError) throw profileError
    if (!profile?.phone) {
      return NextResponse.json({
        error: 'ADMIN_PROFILE_PHONE_REQUIRED: Admin akkauntiga tegishli profiles yozuvi va tasdiqlangan telefon raqami topilmadi.',
      }, { status: 409 })
    }

    const token = randomBytes(24).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const { error: insertError } = await db.from('telegram_link_tokens').insert({
      token_hash: tokenHash,
      profile_id: profile.id,
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
