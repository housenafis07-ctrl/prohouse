import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
    if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    const supabase = serviceClient()

    const statuses = ['active', 'moderation', 'rejected', 'sold', 'rented', 'archived'] as const
    const [{ count: total, error: totalError }, ...statusResults] = await Promise.all([
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
      ...statuses.map(async status => {
        const { count, error } = await supabase.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('status', status)
        return { status, count: count ?? 0, error }
      }),
    ])
    const { data: leads, error: leadsError } = await supabase
      .from('listing_leads')
      .select('status,created_at,first_responded_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (totalError) throw totalError
    const failed = statusResults.find(item => item.error)
    if (failed?.error) throw failed.error
    if (leadsError) throw leadsError
    const counts = Object.fromEntries(statusResults.map(item => [item.status, item.count]))
    const leadRows = leads || []
    const responseMinutes = leadRows
      .filter(item => item.first_responded_at)
      .map(item => Math.max(0, (new Date(item.first_responded_at as string).getTime() - new Date(item.created_at).getTime()) / 60000))
    const avgResponseMinutes = responseMinutes.length
      ? Math.round(responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length)
      : null

    return NextResponse.json({
      total: total ?? 0,
      active: counts.active ?? 0,
      moderation: counts.moderation ?? 0,
      rejected: counts.rejected ?? 0,
      sold: counts.sold ?? 0,
      rented: counts.rented ?? 0,
      archived: counts.archived ?? 0,
      leads: leadRows.length,
      newLeads: leadRows.filter(item => item.status === 'new').length,
      contactedLeads: leadRows.filter(item => item.status === 'contacted').length,
      avgResponseMinutes,
    })
  } catch (error) {
    console.error('[Account stats] Failed', error)
    return NextResponse.json({ error: 'ACCOUNT_STATS_FAILED' }, { status: 500 })
  }
}
