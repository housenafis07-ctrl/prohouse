import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, serviceClient } from '@/utils/admin/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getBotUsername() {
  const token = process.env.TELEGRAM_MODERATION_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_MODERATION_BOT_TOKEN_NOT_CONFIGURED')
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok || !result.ok || !result.result?.username) {
    throw new Error(result.description || 'MODERATION_BOT_USERNAME_UNAVAILABLE')
  }
  return String(result.result.username)
}

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const db = serviceClient()
    const { data, error: queryError } = await db
      .from('telegram_moderators')
      .select('id,telegram_user_id,chat_id,username,first_name,is_active,invited_by,linked_at,created_at,updated_at')
      .order('created_at', { ascending: false })
    if (queryError && (queryError.code === 'PGRST205' || queryError.code === '42P01')) {
      return NextResponse.json({ moderators: [], migrationPending: true }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (queryError) throw queryError
    return NextResponse.json({ moderators: data || [], migrationPending: false }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    console.error('[admin/telegram/moderators] list failed', cause)
    return NextResponse.json({ error: 'Moderatorlar ro‘yxatini yuklab bo‘lmadi.' }, { status: 500 })
  }
}

export async function POST() {
  const { admin, error } = await requireSuperAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const db = serviceClient()
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const { error: insertError } = await db.from('telegram_moderator_invites').insert({
      token_hash: tokenHash,
      created_by: admin.user.id,
      expires_at: expiresAt,
    })
    if (insertError) throw insertError

    const username = await getBotUsername()
    return NextResponse.json({
      inviteUrl: `https://t.me/${username}?start=link_${rawToken}`,
      expiresAt,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    console.error('[admin/telegram/moderators] invite creation failed', cause)
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Taklif havolasi yaratilmadi.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const isActive = body.isActive
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Moderator ID yoki holat noto‘g‘ri.' }, { status: 400 })
    }

    const { data, error: updateError } = await serviceClient()
      .from('telegram_moderators')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id,is_active')
      .maybeSingle()
    if (updateError) throw updateError
    if (!data) return NextResponse.json({ error: 'Moderator topilmadi.' }, { status: 404 })
    return NextResponse.json({ ok: true, moderator: data })
  } catch (cause) {
    console.error('[admin/telegram/moderators] update failed', cause)
    return NextResponse.json({ error: 'Moderator holatini yangilab bo‘lmadi.' }, { status: 500 })
  }
}
