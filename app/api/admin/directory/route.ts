import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Forbidden' ? 403 : 401 })

  const db = serviceClient()
  const q = request.nextUrl.searchParams.get('q')?.trim() || ''
  const pattern = `%${q.replace(/[%_]/g, '\\$&')}%`

  const [{ count: clients }, { count: listings }] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('listings').select('*', { count: 'exact', head: true }),
  ])

  if (!q) return NextResponse.json({ counts: { clients: clients ?? 0, listings: listings ?? 0 }, results: [] })

  const [profilesResult, listingsResult] = await Promise.all([
    db.from('profiles').select('id,profile_code,full_name,company_name,phone,account_type').or(`profile_code.ilike.${pattern},full_name.ilike.${pattern},company_name.ilike.${pattern},phone.ilike.${pattern}`).limit(30),
    db.from('listings').select('id,listing_code,title,status,owner_id,seller_name,seller_phone').or(`listing_code.ilike.${pattern},title.ilike.${pattern},seller_name.ilike.${pattern},seller_phone.ilike.${pattern}`).limit(30),
  ])
  if (profilesResult.error) return NextResponse.json({ error: profilesResult.error.message }, { status: 400 })
  if (listingsResult.error) return NextResponse.json({ error: listingsResult.error.message }, { status: 400 })

  const owners = (profilesResult.data || []).map(p => p.id)
  const listingCounts = new Map<string, number>()
  if (owners.length) {
    const { data } = await db.from('listings').select('owner_id').in('owner_id', owners)
    for (const row of data || []) listingCounts.set(row.owner_id, (listingCounts.get(row.owner_id) || 0) + 1)
  }

  const profileRows = (profilesResult.data || []).map(p => ({ kind: 'profile' as const, id: p.id, code: p.profile_code, name: p.company_name || p.full_name, phone: p.phone, accountType: p.account_type, listingCount: listingCounts.get(p.id) || 0 }))
  const listingRows = (listingsResult.data || []).map(l => ({ kind: 'listing' as const, id: l.id, code: l.listing_code, name: l.seller_name, phone: l.seller_phone, title: l.title, status: l.status, ownerId: l.owner_id }))

  return NextResponse.json({ counts: { clients: clients ?? 0, listings: listings ?? 0 }, results: [...listingRows, ...profileRows] })
}
