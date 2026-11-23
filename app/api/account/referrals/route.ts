import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

async function currentUserId() {
  const store = await cookies()
  return readAccountSession(store.get(ACCOUNT_SESSION_COOKIE)?.value)
}

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const db = serviceClient()
  const [{ data: profile, error }, { data: rewards, error: rewardsError }, { data: wallet }] = await Promise.all([
    db.from('profiles').select('referral_code,referred_by').eq('id', userId).maybeSingle(),
    db.from('referral_rewards').select('id,invitee_id,amount_uzs,created_at,status').eq('referrer_id', userId).order('created_at', { ascending: false }).limit(50),
    db.from('wallet_accounts').select('bonus_balance').eq('user_id', userId).maybeSingle(),
  ])
  if (error || rewardsError) return NextResponse.json({ error: error?.message || rewardsError?.message || 'REFERRAL_LOAD_FAILED' }, { status: 500 })
  const { count: invitedCount } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', userId)
  return NextResponse.json({ code: profile?.referral_code || null, referredBy: Boolean(profile?.referred_by), invitedCount: invitedCount || 0, rewards: rewards || [], bonusBalance: Number(wallet?.bonus_balance || 0) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!/^[A-Z0-9]{6,12}$/.test(code)) return NextResponse.json({ error: 'Taklif kodini tekshiring.' }, { status: 400 })

  const db = serviceClient()
  const { data: profile, error: profileError } = await db.from('profiles').select('referred_by,referral_code').eq('id', userId).maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'Profil topilmadi.' }, { status: 404 })
  if (profile.referred_by) return NextResponse.json({ error: 'Siz taklif kodini avval ishlatgansiz.' }, { status: 409 })
  if (profile.referral_code === code) return NextResponse.json({ error: 'O‘z taklif kodingizni ishlata olmaysiz.' }, { status: 400 })

  const { data: inviter, error: inviterError } = await db.from('profiles').select('id').eq('referral_code', code).maybeSingle()
  if (inviterError) return NextResponse.json({ error: inviterError.message }, { status: 500 })
  if (!inviter) return NextResponse.json({ error: 'Taklif kodi topilmadi.' }, { status: 404 })

  const { count: activeListings } = await db.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('status', 'active')
  if ((activeListings || 0) > 0) return NextResponse.json({ error: 'Taklif kodi faqat birinchi faol e’loningizdan oldin qo‘shilishi mumkin.' }, { status: 409 })

  const { error: updateError } = await db.from('profiles').update({ referred_by: inviter.id }).eq('id', userId).is('referred_by', null)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
