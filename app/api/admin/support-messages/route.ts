import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const statuses = ['new', 'in_progress', 'replied', 'closed']

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const admin = serviceClient()
  let query = admin
    .from('support_messages')
    .select('id,name,phone,email,subject,message,source,telegram_user_id,telegram_username,status,admin_note,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status && statuses.includes(status)) query = query.eq('status', status)

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ messages: data || [] })
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const body = await request.json()
    const id = String(body?.id || '')
    const status = String(body?.status || '')
    const adminNote = String(body?.admin_note || '').trim().slice(0, 3000)

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    if (!statuses.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

    const admin = serviceClient()
    const { error: dbError } = await admin
      .from('support_messages')
      .update({ status, admin_note: adminNote || null })
      .eq('id', id)

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
