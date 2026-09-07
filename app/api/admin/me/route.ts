import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/utils/admin/auth'

export async function GET() {
  const current = await getCurrentAdmin()
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ user: { id: current.user.id, email: current.user.email }, role: current.role.role })
}
