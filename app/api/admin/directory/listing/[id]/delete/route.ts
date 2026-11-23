import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin('listings.moderate')
  if (error) return NextResponse.json({ error }, { status: error === 'Forbidden' ? 403 : 401 })
  const { id } = await params
  const db = serviceClient()
  const { error: deleteError } = await db.from('listings').delete().eq('id', id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })
  return NextResponse.json({ ok: true, message: 'E’lon o‘chirildi.' })
}
