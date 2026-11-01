import { getCurrentAdmin, serviceClient } from '@/utils/admin/auth'
import { redirect } from 'next/navigation'
import TrustedPartnersClient from './TrustedPartnersClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TrustedPartnersPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')

  const db = serviceClient()
  const { data: partnerRows, error: partnerError } = await db
    .from('partner_profiles')
    .select('id,user_id,partner_type,legal_form,display_name,company_name,verification_status,trusted_partner_status,trusted_partner_rejection_reason,trusted_partner_reviewed_at,updated_at')
    .in('trusted_partner_status', ['requested', 'under_review', 'verified', 'rejected'])
    .order('updated_at', { ascending: false })

  if (partnerError) throw new Error(partnerError.message)

  const partnersBase = partnerRows || []
  const partnerUserIds = partnersBase.map(row => row.user_id).filter(Boolean)

  const [{ data: profiles }, { data: documents }] = await Promise.all([
    partnerUserIds.length
      ? db.from('profiles')
        .select('id,full_name,phone,inn,company_name')
        .in('id', partnerUserIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; phone: string | null; inn: string | null; company_name: string | null }> }),
    partnerUserIds.length
      ? db.from('partner_verification_documents')
        .select('id,user_id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,storage_path,created_at,reviewed_at')
        .in('user_id', partnerUserIds)
        .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Array<{ id: string; user_id: string; document_type: string; file_name: string; mime_type: string; size_bytes: number; status: string; rejection_reason: string | null; storage_path: string; created_at: string; reviewed_at: string | null }> }),
  ])

  const { data: individualRows, error: individualError } = await db
    .from('profiles')
    .select('id,full_name,phone,account_type,partner_type,trusted_profile,trusted_profile_opt_in,trusted_profile_program_status,myid_status,myid_verified_at,trusted_profile_rejection_reason,trusted_profile_reviewed_at,manual_verification_status')
    .eq('account_type', 'individual')
    .or('trusted_profile_opt_in.eq.true,trusted_profile.eq.true')
    .order('updated_at', { ascending: false })

  if (individualError) throw new Error(individualError.message)

  const individualUserIds = (individualRows || []).map(row => row.id)
  const { data: identityDocuments, error: identityDocumentsError } = individualUserIds.length
    ? await db.from('partner_verification_documents')
      .select('id,user_id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,storage_path,created_at,reviewed_at')
      .in('user_id', individualUserIds).like('document_type', 'identity_%').order('created_at', { ascending: false })
    : { data: [], error: null }
  if (identityDocumentsError) throw new Error(identityDocumentsError.message)

  const profileById = new Map((profiles || []).map(profile => [profile.id, profile]))
  const partners = partnersBase.map(partner => ({
    ...partner,
    profiles: profileById.get(partner.user_id) || null,
  }))

  return (
    <TrustedPartnersClient
      partners={partners}
      documents={[...(documents || []), ...(identityDocuments || [])]}
      individuals={individualRows || []}
    />
  )
}
