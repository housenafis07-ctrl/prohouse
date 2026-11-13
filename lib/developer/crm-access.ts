import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

export type DeveloperCrmRole = 'owner' | 'admin' | 'sales_manager' | 'sales_agent' | 'marketing' | 'analyst'
const roles: DeveloperCrmRole[] = ['owner', 'admin', 'sales_manager', 'sales_agent', 'marketing', 'analyst']

export async function getDeveloperCrmContext() {
  const cookieStore = await cookies()
  const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return { error: 'AUTH_REQUIRED' as const }

  const db = serviceClient()
  const { data: account, error: accountError } = await db.from('profiles')
    .select('id,account_type').eq('id', userId).maybeSingle()
  if (accountError) return { error: 'ACCOUNT_LOOKUP_FAILED' as const }
  if (!account || account.account_type !== 'partner') return { error: 'PARTNER_ACCOUNT_REQUIRED' as const }

  const { data: partner, error: partnerError } = await db.from('partner_profiles')
    .select('id,user_id').eq('user_id', userId).maybeSingle()
  if (partnerError) return { error: 'PARTNER_PROFILE_LOOKUP_FAILED' as const }
  if (!partner) return { error: 'PARTNER_PROFILE_REQUIRED' as const }

  const { data: developer, error: developerError } = await db.from('developer_profiles')
    .select('id,user_id,developer_name,verification_status,partner_profile_id')
    .eq('partner_profile_id', partner.id).maybeSingle()
  if (developerError) return { error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' as const }
  if (!developer) return { error: 'DEVELOPER_PROFILE_REQUIRED' as const }
  if (developer.verification_status !== 'verified') return { error: 'DEVELOPER_NOT_APPROVED' as const }

  // The partner-profile owner is the company owner for existing single-owner accounts.
  if (!developer.user_id || developer.user_id === userId) {
    return { db, userId, developer, role: 'owner' as DeveloperCrmRole }
  }

  const { data: membership, error: membershipError } = await db.from('developer_team_members')
    .select('role,status').eq('developer_id', developer.id).eq('user_id', userId).maybeSingle()
  if (membershipError) return { error: 'TEAM_MEMBERSHIP_LOOKUP_FAILED' as const }
  if (!membership || membership.status !== 'active' || !roles.includes(membership.role as DeveloperCrmRole)) {
    return { error: 'DEVELOPER_PROFILE_ACCESS_DENIED' as const }
  }
  return { db, userId, developer, role: membership.role as DeveloperCrmRole }
}

export function canManageTeam(role: DeveloperCrmRole) {
  return role === 'owner' || role === 'admin'
}
export function canManageAssignments(role: DeveloperCrmRole) {
  return role === 'owner' || role === 'admin' || role === 'sales_manager'
}
