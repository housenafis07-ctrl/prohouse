import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const { data, error } = await supabase
    .from('listings')
    .select('id,title,price,city,district,status')
    .eq('owner_id', user.id)
    .in('status', ['active', 'moderation'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ listings: data ?? [] })
}
