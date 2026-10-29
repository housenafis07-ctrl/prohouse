import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

export async function GET() {
  const cookieStore = await cookies()
  const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const db = serviceClient()
  const { data, error } = await db.from('listings')
    .select('id,listing_code,title,title_ru,listing_type,property_type,status,price,currency,city,district,area_m2,rooms,floor,floors_total,is_trusted_seller,updated_at,moderation_note,seller_type,is_mortgage_available,primary_image_url,promoted_until,promotion_badge,bumped_at,partner_listing_taxonomy(name_uz,name_ru)')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ listings: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}
