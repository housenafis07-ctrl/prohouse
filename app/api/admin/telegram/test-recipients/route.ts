import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export async function GET() {
  const { error: authError } = await requireAdmin('listings.moderate')
  if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })

  const db = serviceClient()
  // This RPC is the single source of truth for active bot users who have
  // explicitly opted in to marketing under the current offer.
  const { data: eligible, error: eligibilityError } = await db.rpc('get_telegram_broadcast_recipients', { p_audience: 'all' })
  if (eligibilityError) {
    console.error('[telegram test recipients] eligibility lookup failed', eligibilityError)
    return NextResponse.json({
      recipients: [],
      schemaReady: false,
      error: 'Marketing roziligi migratsiyasi bazaga qo‘llanmagan yoki auditoriya tekshiruvi mavjud emas. Rozilikni chetlab o‘tib mijozga test yuborilmaydi.',
    }, { status: 503 })
  }

  const telegramIds = [...new Set((eligible || []).map((row: { telegram_id?: string }) => String(row.telegram_id || '')).filter(Boolean))]
  if (!telegramIds.length) return NextResponse.json({ recipients: [], schemaReady: true })

  const { data: users, error: usersError } = await db
    .from('telegram_bot_users')
    .select('telegram_user_id,profile_id,username,first_name,last_name,last_interaction_at')
    .eq('is_active', true)
    .not('profile_id', 'is', null)
    .in('telegram_user_id', telegramIds)
    .order('last_interaction_at', { ascending: false })
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  const profileIds = [...new Set((users || []).map((row: any) => row.profile_id).filter(Boolean))]
  const { data: profiles, error: profilesError } = profileIds.length
    ? await db.from('profiles').select('id,full_name,phone').in('id', profileIds)
    : { data: [], error: null }
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })

  const profileById = new Map((profiles || []).map((profile: any) => [profile.id, profile]))
  const recipients = (users || []).map((user: any) => {
    const profile = profileById.get(user.profile_id)
    const phone = String(profile?.phone || '')
    const maskedPhone = phone ? `${phone.slice(0, 4)}••••${phone.slice(-3)}` : null
    const name = String(profile?.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Telegram foydalanuvchisi')
    return {
      telegramUserId: user.telegram_user_id,
      label: name,
      phone: maskedPhone,
      username: user.username ? `@${user.username}` : null,
      lastInteractionAt: user.last_interaction_at,
    }
  })

  return NextResponse.json({ recipients, schemaReady: true }, { headers: { 'Cache-Control': 'no-store' } })
}
