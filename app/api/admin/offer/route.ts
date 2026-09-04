import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server configuration is missing')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function authorized(request: NextRequest) {
  const configured = process.env.PROHOUSE_ADMIN_PASSWORD
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return Boolean(configured && supplied && supplied === configured)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const supabase = adminClient()
    const { data, error } = await supabase
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
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Ommaviy oferta'
    if (!content) return NextResponse.json({ error: 'Oferta matni bo‘sh bo‘lishi mumkin emas.' }, { status: 400 })

    const supabase = adminClient()
    const { data: latest, error: latestError } = await supabase
      .from('offer_versions')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestError) throw latestError

    const nextVersion = (latest?.version ?? 0) + 1
    const { error: deactivateError } = await supabase
      .from('offer_versions')
      .update({ is_active: false })
      .eq('is_active', true)
    if (deactivateError) throw deactivateError

    const { data, error } = await supabase
      .from('offer_versions')
      .insert({ version: nextVersion, title, content, is_active: true })
      .select('id,version,title,content,is_active,created_at')
      .single()
    if (error) throw error

    return NextResponse.json({ offer: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Oferta saqlanmadi' }, { status: 500 })
  }
}
