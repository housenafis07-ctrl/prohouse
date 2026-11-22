import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin('listings.moderate')
  if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })
  const leadId = request.nextUrl.searchParams.get('leadId')
  if (!leadId) return NextResponse.json({ error: 'leadId talab qilinadi.' }, { status: 400 })
  try {
    const admin = serviceClient()
    const { data: lead, error } = await admin.from('mortgage_leads')
      .select('id,identity_document_front_path,identity_document_back_path,identity_selfie_path')
      .eq('id', leadId).maybeSingle()
    if (error) throw error
    if (!lead) return NextResponse.json({ error: 'Ariza topilmadi.' }, { status: 404 })
    const paths = {
      front: lead.identity_document_front_path,
      back: lead.identity_document_back_path,
      selfie: lead.identity_selfie_path,
    }
    const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => {
      if (!path) return [key, null]
      const { data, error: signedError } = await admin.storage.from('mortgage-identity').createSignedUrl(path, 60)
      if (signedError) throw signedError
      return [key, data.signedUrl]
    }))
    return NextResponse.json({ documents: Object.fromEntries(entries) })
  } catch (error) {
    console.error('[Mortgage admin documents]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Hujjatlar ochilmadi.' }, { status: 500 })
  }
}
