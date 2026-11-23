import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'
import { notifyModeratorsAboutListing } from '@/utils/telegram/moderation'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params
    const cookieStore = await cookies()
    let userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
    if (!userId) {
      const auth = await createClient()
      const { data: { user } } = await auth.auth.getUser()
      userId = user?.id || null
    }
    if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const db = serviceClient()
    const { data: listing, error } = await db.from('listings')
      .select('id,status')
      .eq('id', listingId)
      .eq('owner_id', userId)
      .maybeSingle()
    if (error) throw error
    if (!listing) return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 })
    if (listing.status !== 'moderation') return NextResponse.json({ error: 'LISTING_NOT_IN_MODERATION' }, { status: 409 })

    const delivery = await notifyModeratorsAboutListing(listingId)
    return NextResponse.json({ success: true, delivery })
  } catch (error) {
    console.error('[listing-moderation-notify]', error)
    return NextResponse.json({
      error: 'MODERATION_NOTIFICATION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown notification error',
    }, { status: 500 })
  }
}
