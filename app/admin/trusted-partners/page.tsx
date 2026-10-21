import { getCurrentAdmin, serviceClient } from '@/utils/admin/auth'
import { redirect } from 'next/navigation'
import TrustedPartnersClient from './TrustedPartnersClient'

export default async function TrustedPartnersPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')

  const db = serviceClient()
  const { data: partners } = await db
    .from('partner_profiles')
    .select('id,user_id,partner_type,legal_form,display_name,company_name,verification_status,trusted_partner_status,trusted_partner_rejection_reason,trusted_partner_reviewed_at,updated_at,profiles!inner(full_name,phone,inn,company_name)')
    .in('trusted_partner_status', ['requested', 'under_review', 'verified', 'rejected'])
    .order('updated_at', { ascending: false })

  const userIds = (partners || []).map(row => row.user_id).filter(Boolean)
  const { data: documents } = userIds.length
    ? await db.from('partner_verification_documents')
      .select('id,user_id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,storage_path,created_at,reviewed_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
    : { data: [] }

  const signedDocuments = await Promise.all((documents || []).map(async document => {
    const { data } = await db.storage.from('partner-verification-documents').createSignedUrl(document.storage_path, 900)
    return { ...document, signed_url: data?.signedUrl || null }
  }))

  return <TrustedPartnersClient partners={partners || []} documents={signedDocuments} />
}
