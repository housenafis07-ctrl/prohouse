import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const statuses = ['active', 'moderation', 'rejected', 'sold', 'rented', 'archived'] as const
    const [{ count: total, error: totalError }, ...statusResults] = await Promise.all([
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
      ...statuses.map(async status => {
        const { count, error } = await supabase.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', user.id).eq('status', status)
        return { status, count: count ?? 0, error }
      }),
    ])
    if (totalError) throw totalError
    const failed = statusResults.find(item => item.error)
    if (failed?.error) throw failed.error
    const counts = Object.fromEntries(statusResults.map(item => [item.status, item.count]))

    return NextResponse.json({
      total: total ?? 0,
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
