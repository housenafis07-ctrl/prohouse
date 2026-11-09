import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const profileId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
    if (!profileId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const rawToken = typeof body?.token === 'string' ? body.token : ''
    if (!/^[a-f0-9]{48}$/i.test(rawToken)) return NextResponse.json({ error: 'INVALID_LINK_TOKEN' }, { status: 400 })

    const db = serviceClient()
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const { data: token, error: tokenError } = await db.from('telegram_link_tokens')
      .select('token_hash,telegram_user_id,profile_id,expires_at,used_at')
      .eq('token_hash', tokenHash).maybeSingle()
    if (tokenError) throw tokenError
    if (!token || token.used_at || !token.telegram_user_id || token.profile_id || new Date(token.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'LINK_TOKEN_EXPIRED_OR_USED' }, { status: 409 })
    }

    const { data: profile, error: profileError } = await db.from('profiles')
      .select('phone').eq('id', profileId).maybeSingle()
    if (profileError) throw profileError
    if (!profile?.phone) return NextResponse.json({ error: 'PROFILE_PHONE_REQUIRED' }, { status: 400 })

    const { data: claim, error: claimError } = await db.from('phone_verification_claims')
      .select('phone').eq('phone', profile.phone).gte('verified_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).maybeSingle()
    if (claimError) throw claimError
    if (!claim) return NextResponse.json({ error: 'PHONE_VERIFICATION_REQUIRED' }, { status: 403 })

    const { error: bindError } = await db.from('telegram_link_tokens')
      .update({ profile_id: profileId, auth_user_id: profileId })
      .eq('token_hash', tokenHash).is('profile_id', null).is('used_at', null)
    if (bindError) throw bindError
    const { error: linkError } = await db.rpc('link_telegram_identity', {
      p_profile_id: profileId,
      p_telegram_user_id: token.telegram_user_id,
      p_chat_id: token.telegram_user_id,
      p_telegram_username: null,
      p_linked_at: new Date().toISOString(),
    })
    if (linkError) throw linkError

    const { error: consumeError } = await db.from('telegram_link_tokens')
      .update({ used_at: new Date().toISOString() }).eq('token_hash', tokenHash).is('used_at', null)
    if (consumeError) throw consumeError
    return NextResponse.json({ ok: true, linked: true })
  } catch (error) {
    console.error('[Telegram registration link] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TELEGRAM_LINK_FAILED' }, { status: 500 })
  }
}
