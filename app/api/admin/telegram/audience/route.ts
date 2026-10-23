import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export const dynamic = 'force-dynamic'

type AudienceKey = 'all' | 'buyers' | 'listings' | 'realtors' | 'trusted'

async function getAudienceCounts(db: ReturnType<typeof serviceClient>) {
  const { data: users, error: usersError } = await db
    .from('telegram_bot_users')
    .select('telegram_user_id,chat_id,profile_id,is_blocked,chat_type')
    .eq('chat_type', 'private')
    .eq('is_blocked', false)

  if (usersError) throw usersError

  const activeUsers = users || []
  const profileIds = [...new Set(activeUsers.map(user => user.profile_id).filter(Boolean))]

  if (!profileIds.length) {
    return { all: activeUsers.length, buyers: 0, listings: 0, realtors: 0, trusted: 0 }
  }

  const [{ data: profiles, error: profilesError }, { data: listings, error: listingsError }, { data: partners, error: partnersError }] = await Promise.all([
    db.from('profiles').select('id,account_type,partner_type,trusted_profile').in('id', profileIds),
    db.from('listings').select('owner_id').in('owner_id', profileIds).neq('status', 'deleted'),
    db.from('partner_profiles').select('user_id,partner_type,trusted_partner_status').in('user_id', profileIds),
  ])

  if (profilesError) throw profilesError
  if (listingsError) throw listingsError
  if (partnersError) throw partnersError

  const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]))
  const listingOwners = new Set((listings || []).map(row => row.owner_id).filter(Boolean))
  const partnerMap = new Map((partners || []).map(row => [row.user_id, row]))

  let buyers = 0
  let listingAuthors = 0
  let realtors = 0
  let trusted = 0

  for (const user of activeUsers) {
    if (!user.profile_id) continue
    const profile = profileMap.get(user.profile_id)
    if (!profile) continue
    const partner = partnerMap.get(user.profile_id)

    const isRealtor = profile.partner_type === 'realtor' || partner?.partner_type === 'realtor'
    const isTrusted = Boolean(profile.trusted_profile) || partner?.trusted_partner_status === 'verified'
    const hasListings = listingOwners.has(user.profile_id)

    if (isRealtor) realtors += 1
    if (hasListings) listingAuthors += 1
    if (isTrusted) trusted += 1
    if (profile.account_type === 'individual' && !isRealtor && !hasListings) buyers += 1
  }

  return { all: activeUsers.length, buyers, listings: listingAuthors, realtors, trusted }
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const counts = await getAudienceCounts(serviceClient())
    return NextResponse.json(counts)
  } catch (error) {
    console.error('telegram audience counts failed', error)
    return NextResponse.json({ error: 'Telegram auditoriyalarini yuklab bo‘lmadi.' }, { status: 500 })
  }
}

export async function getTelegramAudience(
  db: ReturnType<typeof serviceClient>,
  audience: AudienceKey,
) {
  const { data: users, error: usersError } = await db
    .from('telegram_bot_users')
    .select('id,telegram_user_id,chat_id,profile_id,is_blocked,chat_type')
    .eq('chat_type', 'private')
    .eq('is_blocked', false)

  if (usersError) throw usersError
  if (!users?.length) return []
  if (audience === 'all') return users

  const profileIds = [...new Set(users.map(user => user.profile_id).filter(Boolean))]
  if (!profileIds.length) return []

  const [{ data: profiles, error: profilesError }, { data: listings, error: listingsError }, { data: partners, error: partnersError }] = await Promise.all([
    db.from('profiles').select('id,account_type,partner_type,trusted_profile').in('id', profileIds),
    db.from('listings').select('owner_id').in('owner_id', profileIds).neq('status', 'deleted'),
    db.from('partner_profiles').select('user_id,partner_type,trusted_partner_status').in('user_id', profileIds),
  ])

  if (profilesError) throw profilesError
  if (listingsError) throw listingsError
  if (partnersError) throw partnersError

  const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]))
  const listingOwners = new Set((listings || []).map(row => row.owner_id).filter(Boolean))
  const partnerMap = new Map((partners || []).map(row => [row.user_id, row]))

  return users.filter(user => {
    if (!user.profile_id) return false
    const profile = profileMap.get(user.profile_id)
    if (!profile) return false
    const partner = partnerMap.get(user.profile_id)
    const isRealtor = profile.partner_type === 'realtor' || partner?.partner_type === 'realtor'
    const isTrusted = Boolean(profile.trusted_profile) || partner?.trusted_partner_status === 'verified'
    const hasListings = listingOwners.has(user.profile_id)

    if (audience === 'realtors') return isRealtor
    if (audience === 'trusted') return isTrusted
    if (audience === 'listings') return hasListings
    return profile.account_type === 'individual' && !isRealtor && !hasListings
  })
}
