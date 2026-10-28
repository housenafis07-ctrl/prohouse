import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const statuses = ['active', 'moderation', 'rejected', 'sold', 'rented', 'archived'] as const
    const results = await Promise.all(
      statuses.map(async status => {
        const { count, error } = await supabase
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .eq('status', status)
        if (error) throw error
        return [status, count ?? 0] as const
      })
    )

    const counts = Object.fromEntries(results)
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0)

    return NextResponse.json({
      total,
      active: counts.active ?? 0,
      moderation: counts.moderation ?? 0,
      rejected: counts.rejected ?? 0,
      sold: counts.sold ?? 0,
      rented: counts.rented ?? 0,
      archived: counts.archived ?? 0,
    })
  } catch (error) {
    console.error('[Account stats] Failed', error)
    return NextResponse.json({ error: 'ACCOUNT_STATS_FAILED' }, { status: 500 })
  }
}
