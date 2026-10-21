import { getCurrentAdmin, serviceClient } from '@/utils/admin/auth'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid document id' }, { status: 400 })

  const db = serviceClient()
  const { data: document, error: documentError } = await db
    .from('partner_verification_documents')
    .select('id,storage_path')
    .eq('id', id)
    .maybeSingle()

  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })
  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { data, error: signedUrlError } = await db.storage
    .from('partner-verification-documents')
    .createSignedUrl(document.storage_path, 900)

  if (signedUrlError || !data?.signedUrl) {
    return NextResponse.json({ error: signedUrlError?.message || 'Could not create document URL' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
