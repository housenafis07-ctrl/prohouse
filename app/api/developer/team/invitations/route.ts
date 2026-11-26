import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

async function currentUser() {
  const store = await cookies()
  return readAccountSession(store.get(ACCOUNT_SESSION_COOKIE)?.value)
}
export async function GET() {
  const userId = await currentUser()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const db = serviceClient()
  const { data, error } = await db.from('developer_team_members')
    .select('id,developer_id,role,invited_at')
    .eq('user_id', userId).eq('status', 'invited').order('invited_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'INVITATIONS_LOAD_FAILED' }, { status: 500 })
  const ids = [...new Set((data || []).map(item => item.developer_id))]
  const { data: developers, error: developerError } = ids.length
    ? await db.from('developer_profiles').select('id,developer_name,description,logo_url').in('id', ids)
    : { data: [], error: null }
  if (developerError) return NextResponse.json({ error: 'INVITATION_COMPANIES_LOAD_FAILED' }, { status: 500 })
  const byId = new Map((developers || []).map(item => [item.id, item]))
  return NextResponse.json({ invitations: (data || []).map(item => ({ ...item, developer: byId.get(item.developer_id) || null })) })
}
export async function POST(request: Request) {
  const userId = await currentUser()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'INVITATION_REQUIRED' }, { status: 400 })
  const db = serviceClient()
  const { data, error } = await db.from('developer_team_members').update({
    status: 'active', joined_at: new Date().toISOString(),
  }).eq('id', id).eq('user_id', userId).eq('status', 'invited')
    .select('id,developer_id,role,status').maybeSingle()
  if (error) return NextResponse.json({ error: 'INVITATION_ACCEPT_FAILED' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'INVITATION_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ membership: data })
}
