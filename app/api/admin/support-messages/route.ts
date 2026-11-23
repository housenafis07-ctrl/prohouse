import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const statuses = ['new', 'in_progress', 'replied', 'closed']

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const countOnly = url.searchParams.get('countOnly') === '1'
  const admin = serviceClient()

  if (countOnly) {
    let countQuery = admin
      .from('support_messages')
      .select('id', { count: 'exact', head: true })

    if (status && statuses.includes(status)) countQuery = countQuery.eq('status', status)

    const { count, error: dbError } = await countQuery
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json({ count: count ?? 0 })
  }

  let query = admin
    .from('support_messages')
    .select('id,user_id,name,phone,email,subject,message,source,telegram_user_id,telegram_username,status,priority,admin_note,created_at,updated_at')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
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
