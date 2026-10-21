import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const DOCUMENT_TYPES = new Set([
  'registration_certificate',
  'inn_certificate',
  'director_id',
  'self_employed_certificate',
  'sole_proprietor_certificate',
  'company_charter',
])

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
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'FILE_TYPE_NOT_ALLOWED' }, { status: 400 })
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'FILE_SIZE_NOT_ALLOWED' }, { status: 400 })

  const admin = serviceClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,account_type,partner_type')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile || profile.account_type !== 'partner') {
    return NextResponse.json({ error: 'PARTNER_ONLY' }, { status: 403 })
  }

  const { data: partner, error: partnerError } = await admin
    .from('partner_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 500 })
  if (!partner) return NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 400 })

  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'bin'
  const storagePath = `${user.id}/${crypto.randomUUID()}.${safeExtension}`

  const { error: uploadError } = await admin.storage
    .from('partner-verification-documents')
    .upload(storagePath, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: document, error: insertError } = await admin
    .from('partner_verification_documents')
    .insert({
      user_id: user.id,
      partner_profile_id: partner.id,
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

  const { error: statusError } = await admin
    .from('partner_profiles')
    .update({ trusted_partner_status: 'requested', trusted_partner_rejection_reason: null, updated_at: new Date().toISOString() })
    .eq('id', partner.id)
  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 })

  return NextResponse.json({ document }, { status: 201 })
}
