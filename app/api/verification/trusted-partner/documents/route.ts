import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const DOCUMENT_TYPES = new Set([
  'registration_certificate',
  'other_required_documents',
  'director_id',
  'self_employed_certificate',
  'sole_proprietor_certificate',
  'company_charter',
  'identity_selfie',
  'identity_passport',
  'identity_id_front',
  'identity_id_back',
])

export async function GET() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const db = serviceClient()
  const [{ data: profile, error: profileError }, { data: documents, error: documentError }] = await Promise.all([
    db.from('profiles').select('account_type,partner_type').eq('id', user.id).maybeSingle(),
    db.from('partner_verification_documents')
      .select('id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,created_at,reviewed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 })
  if (profile.account_type === 'individual') {
    const { data: trusted, error: trustedError } = await db.from('profiles')
      .select('trusted_profile_program_status,trusted_profile_rejection_reason,manual_verification_status')
      .eq('id', user.id).maybeSingle()
    if (trustedError) return NextResponse.json({ error: trustedError.message }, { status: 500 })
    return NextResponse.json({
      accountType: 'individual',
      trustedProfileStatus: trusted?.trusted_profile_program_status || 'not_joined',
      rejectionReason: trusted?.trusted_profile_rejection_reason || null,
      documents: (documents || []).filter(item => item.document_type.startsWith('identity_')),
    })
  }
  if (profile.account_type !== 'partner') return NextResponse.json({ error: 'INVALID_ACCOUNT_TYPE' }, { status: 403 })
  const { data: partner, error: partnerError } = await db.from('partner_profiles')
    .select('trusted_partner_status,trusted_partner_rejection_reason').eq('user_id', user.id).maybeSingle()
  if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 500 })
  return NextResponse.json({ partnerType: profile.partner_type, trustedPartnerStatus: partner?.trusted_partner_status || 'not_requested', rejectionReason: partner?.trusted_partner_rejection_reason || null, documents: documents || [] })
}

export async function POST(request: Request) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'INVALID_FORM_DATA' }, { status: 400 })

  const documentType = typeof form.get('documentType') === 'string' ? String(form.get('documentType')) : ''
  const file = form.get('file')
  if (!DOCUMENT_TYPES.has(documentType)) return NextResponse.json({ error: 'INVALID_DOCUMENT_TYPE' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 })
  const isIdentityDocument = documentType.startsWith('identity_')
  if (isIdentityDocument && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return NextResponse.json({ error: 'IDENTITY_IMAGE_REQUIRED' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'FILE_TYPE_NOT_ALLOWED' }, { status: 400 })
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'FILE_SIZE_NOT_ALLOWED' }, { status: 400 })

  const admin = serviceClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,account_type,partner_type,trusted_profile,trusted_profile_opt_in')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 })
  if (isIdentityDocument && profile.account_type !== 'individual') return NextResponse.json({ error: 'INDIVIDUAL_ONLY' }, { status: 403 })
  if (!isIdentityDocument && profile.account_type !== 'partner') return NextResponse.json({ error: 'PARTNER_ONLY' }, { status: 403 })

  const { data: partner, error: partnerError } = await admin
    .from('partner_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 500 })
  if (!isIdentityDocument && !partner) return NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 400 })

  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'bin'
  const storagePath = `${user.id}/${crypto.randomUUID()}.${safeExtension}`

  const { error: uploadError } = await admin.storage
    .from('partner-verification-documents')
    .upload(storagePath, file, { contentType: file.type, cacheControl: '3600', upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: document, error: insertError } = await admin
    .from('partner_verification_documents')
    .insert({
      user_id: user.id,
      partner_profile_id: partner?.id || null,
      document_type: documentType,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      status: 'submitted',
    })
    .select('id,document_type,file_name,status,created_at')
    .single()

  if (insertError) {
    await admin.storage.from('partner-verification-documents').remove([storagePath])
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  if (isIdentityDocument) {
    const { error: statusError } = await admin.from('profiles').update({
      trusted_profile_opt_in: true,
      trusted_profile_program_status: 'requested',
      trusted_profile_rejection_reason: null,
      manual_verification_status: 'pending',
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)
    if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 })
  } else {
    const { error: statusError } = await admin.from('partner_profiles')
      .update({ trusted_partner_status: 'requested', trusted_partner_rejection_reason: null, updated_at: new Date().toISOString() })
      .eq('id', partner!.id)
    if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 })
  }

  return NextResponse.json({ document }, { status: 201 })
}
