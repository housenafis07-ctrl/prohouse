import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const { data, error } = await supabase.from('saved_searches').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ searches: data || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof body.name !== 'string') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  const { data, error } = await supabase.from('saved_searches').insert({ user_id: user.id, name: body.name.trim().slice(0, 120), query: body.query && typeof body.query === 'object' ? body.query : {}, notify_push: body.notifyPush !== false, notify_email: body.notifyEmail === true }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ search: data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof body.id !== 'string') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 120)
  if (body.query && typeof body.query === 'object') patch.query = body.query
  if (typeof body.isActive === 'boolean') patch.is_active = body.isActive
  if (typeof body.notifyPush === 'boolean') patch.notify_push = body.notifyPush
  if (typeof body.notifyEmail === 'boolean') patch.notify_email = body.notifyEmail
  const { data, error } = await supabase.from('saved_searches').update(patch).eq('id', body.id).eq('user_id', user.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ search: data })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 400 })
  const { error } = await supabase.from('saved_searches').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
