import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, serviceClient } from '@/utils/admin/auth'

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  try {
    const { data, error } = await serviceClient()
      .from('offer_versions')
      .select('id,version,title,content,is_active,created_at')
      .order('version', { ascending: false })
    if (error) throw error
    return NextResponse.json({ offers: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Oferta yuklanmadi' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  try {
    const body = await request.json()
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Ommaviy oferta'
    if (!content) return NextResponse.json({ error: 'Oferta matni bo‘sh bo‘lishi mumkin emas.' }, { status: 400 })

    const supabase = serviceClient()
    const { data: latest, error: latestError } = await supabase
      .from('offer_versions')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestError) throw latestError

    const nextVersion = (latest?.version ?? 0) + 1
    const { data, error } = await supabase.rpc('create_offer_version', {
      p_version: nextVersion,
      p_title: title,
      p_content: content,
    })
    if (error) throw error

    return NextResponse.json({ offer: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Oferta saqlanmadi' }, { status: 500 })
  }
}
