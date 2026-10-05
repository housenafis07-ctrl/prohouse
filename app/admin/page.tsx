import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAdmin, serviceClient } from '@/utils/admin/auth'
import AdminHomeClient from './AdminHomeClient'

async function getStats() {
  const supabase = serviceClient()
  const [{ count: total }, { count: moderation }, { count: active }, { count: rejected }, { count: partners }, { count: today }] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'moderation'),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'partner'),
    supabase.from('listings').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ])
  return { total: total ?? 0, moderation: moderation ?? 0, active: active ?? 0, rejected: rejected ?? 0, partners: partners ?? 0, today: today ?? 0 }
}

export default async function AdminHome() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')
  const stats = await getStats()
  return <AdminHomeClient email={admin.user.email || ''} role={admin.role.role} stats={stats} />
}
