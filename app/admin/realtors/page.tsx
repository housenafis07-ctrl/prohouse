import { redirect } from 'next/navigation'
import { getCurrentAdmin, serviceClient } from '@/utils/admin/auth'
import RealtorModerationClient from './RealtorModerationClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminRealtorsPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')

  const db = serviceClient()
  const { data: rows, error } = await db
    .from('realtor_profiles')
    .select('id,user_id,display_name,phone,certificate_number,certificate_issued_at,certificate_expires_at,registry_number,registry_status,experience_years,agency_name,service_areas,verification_status,verification_rejection_reason,verification_reviewed_at,created_at,updated_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const userIds = (rows || []).map(row => row.user_id).filter(Boolean)
  const { data: profiles, error: profilesError } = userIds.length
    ? await db.from('profiles').select('id,full_name,phone').in('id', userIds)
    : { data: [], error: null }

  if (profilesError) throw new Error(profilesError.message)
  const profileById = new Map((profiles || []).map(profile => [profile.id, profile]))
  const realtors = (rows || []).map(row => ({
    ...row,
    account: profileById.get(row.user_id) || null,
  }))

  return <RealtorModerationClient realtors={realtors} />
}
