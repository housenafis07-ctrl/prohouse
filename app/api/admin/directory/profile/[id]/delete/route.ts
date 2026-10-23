import { NextResponse } from 'next/server'
import { requireSuperAdmin, serviceClient } from '@/utils/admin/auth'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Forbidden' ? 403 : 401 })
  const { id } = await params
  const db = serviceClient()

  const { data: profile, error: profileError } = await db.from('profiles').select('id').eq('id', id).maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })
  if (!profile) return NextResponse.json({ error: 'Mijoz topilmadi' }, { status: 404 })

  const { data: listings, error: listingsError } = await db.from('listings').select('id').eq('owner_id', id)
  if (listingsError) return NextResponse.json({ error: listingsError.message }, { status: 400 })
  if ((listings || []).length) {
    const { error: deleteListingsError } = await db.from('listings').delete().eq('owner_id', id)
    if (deleteListingsError) return NextResponse.json({ error: deleteListingsError.message }, { status: 400 })
  }

  const { error: authError } = await db.auth.admin.deleteUser(id)
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  return NextResponse.json({ ok: true, message: 'Mijoz va unga tegishli e’lonlar o‘chirildi.' })
}
