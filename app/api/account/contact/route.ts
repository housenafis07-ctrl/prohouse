import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

function normalizeUzPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`
  if (digits.length === 9) return `+998${digits}`
  return ''
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null)
  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || ''

  let userId = ''
  if (bearer) {
    const db = serviceClient()
    const { data, error } = await db.auth.getUser(bearer)
    if (!error && data.user) userId = data.user.id
  }

  if (!userId) {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (user) userId = user.id
  }

  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const phone = normalizeUzPhone(typeof body?.phone === 'string' ? body.phone : '')
  if (!phone) return NextResponse.json({ error: 'Telefon raqamini to‘g‘ri kiriting.' }, { status: 400 })

  const db = serviceClient()
  const { data: duplicate } = await db.from('profiles').select('id').eq('phone', phone).neq('id', userId).maybeSingle()
  if (duplicate) return NextResponse.json({ error: 'Bu telefon raqami boshqa profilga biriktirilgan.' }, { status: 409 })

  const { error } = await db.from('profiles').update({ phone }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, phone })
}
