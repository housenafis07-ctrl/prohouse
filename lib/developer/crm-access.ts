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
    .select('id').eq('id', userId).maybeSingle()
  if (accountError) return { error: 'ACCOUNT_LOOKUP_FAILED' as const }
  if (!account) return { error: 'ACCOUNT_NOT_FOUND' as const }

  const { data: partner, error: partnerError } = await db.from('partner_profiles')
    .select('id,user_id').eq('user_id', userId).maybeSingle()
  if (partnerError) return { error: 'PARTNER_PROFILE_LOOKUP_FAILED' as const }

  if (partner) {
    const { data: ownedDeveloper, error } = await db.from('developer_profiles')
      .select('id,user_id,developer_name,verification_status,partner_profile_id')
      .eq('partner_profile_id', partner.id).maybeSingle()
    if (error) return { error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' as const }
    if (ownedDeveloper && ownedDeveloper.verification_status === 'verified'
      && (!ownedDeveloper.user_id || ownedDeveloper.user_id === userId)) {
      return { db, userId, developer: ownedDeveloper, role: 'owner' as DeveloperCrmRole }
    }
    if (ownedDeveloper && ownedDeveloper.user_id && ownedDeveloper.user_id !== userId) {
      const { data: membership, error: memberError } = await db.from('developer_team_members')
        .select('role,status').eq('developer_id', ownedDeveloper.id).eq('user_id', userId).maybeSingle()
      if (memberError) return { error: 'TEAM_MEMBERSHIP_LOOKUP_FAILED' as const }
      if (ownedDeveloper.verification_status === 'verified' && membership?.status === 'active'
        && roles.includes(membership.role as DeveloperCrmRole)) {
        return { db, userId, developer: ownedDeveloper, role: membership.role as DeveloperCrmRole }
      }
    }
  }

  // Staff accounts may be ordinary individual accounts, not partner accounts.
  const { data: memberships, error: membershipsError } = await db.from('developer_team_members')
    .select('developer_id,role,status').eq('user_id', userId).eq('status', 'active')
  if (membershipsError) return { error: 'TEAM_MEMBERSHIP_LOOKUP_FAILED' as const }
  const validMemberships = (memberships || []).filter(item => roles.includes(item.role as DeveloperCrmRole))
  if (!validMemberships.length) return { error: 'DEVELOPER_PROFILE_ACCESS_DENIED' as const }
  if (validMemberships.length > 1) return { error: 'DEVELOPER_COMPANY_SELECTION_REQUIRED' as const }

  const membership = validMemberships[0]
  const { data: developer, error: developerError } = await db.from('developer_profiles')
    .select('id,user_id,developer_name,verification_status,partner_profile_id')
    .eq('id', membership.developer_id).maybeSingle()
  if (developerError) return { error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' as const }
  if (!developer || developer.verification_status !== 'verified') return { error: 'DEVELOPER_NOT_APPROVED' as const }
  return { db, userId, developer, role: membership.role as DeveloperCrmRole }
}

export function canManageTeam(role: DeveloperCrmRole) {
  return role === 'owner' || role === 'admin'
}
export function canManageAssignments(role: DeveloperCrmRole) {
  return role === 'owner' || role === 'admin' || role === 'sales_manager'
}
