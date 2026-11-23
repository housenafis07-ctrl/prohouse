import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const audience = request.nextUrl.searchParams.get('audience') === 'partner' ? 'partner' : 'public'

  try {
    const { data, error } = await serviceClient()
      .from('offer_versions')
      .select('version,title,content,audience')
      .eq('audience', audience)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'ACTIVE_OFFER_NOT_FOUND' }, {
        status: 404,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      })
    }

    return NextResponse.json({ offer: data }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    console.error('[active-offer] load failed', error)
    return NextResponse.json({ error: 'ACTIVE_OFFER_LOAD_FAILED' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  }
}
