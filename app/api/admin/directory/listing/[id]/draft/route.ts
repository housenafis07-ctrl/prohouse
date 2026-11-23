import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin('listings.moderate')
  if (error) return NextResponse.json({ error }, { status: error === 'Forbidden' ? 403 : 401 })
  const { id } = await params
  const { error: updateError } = await serviceClient().from('listings').update({ status: 'draft', moderation_updated_at: new Date().toISOString() }).eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
  return NextResponse.json({ ok: true, message: 'E’lon qoralamaga qaytarildi.' })
}
