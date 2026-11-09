import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { serviceClient } from '@/utils/admin/auth'
import { validateTelegramInitData } from '@/app/lib/telegram-miniapp'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const validated = validateTelegramInitData(initData, 10 * 60)
    if (!validated) return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401 })

    const telegramUserId = String(validated.user.id)
    const rawToken = randomBytes(24).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const db = serviceClient()
    const { error } = await db.from('telegram_link_tokens').insert({
      token_hash: tokenHash,
      profile_id: null,
      auth_user_id: null,
      telegram_user_id: telegramUserId,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    if (error) throw error

    return NextResponse.json({
      ok: true,
      botUrl: `https://t.me/RoyalHouseUz_bot?start=connect_${rawToken}`,
      expiresInSeconds: 900,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[Telegram contact start] failed', error)
    return NextResponse.json({ error: 'TELEGRAM_CONTACT_START_FAILED' }, { status: 500 })
  }
}
