import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const developerId = typeof body?.developer_id === 'string' ? body.developer_id : ''
  if (!developerId) return NextResponse.json({ error: 'DEVELOPER_REQUIRED' }, { status: 400 })
  const db = serviceClient()
  const { data, error } = await db.from('developer_team_members').update({
    status: 'active', joined_at: new Date().toISOString(),
  }).eq('developer_id', developerId).eq('user_id', userId).eq('status', 'invited')
    .select('id,developer_id,role,status').maybeSingle()
  if (error) return NextResponse.json({ error: 'INVITATION_ACCEPT_FAILED' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'INVITATION_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ membership: data })
}
