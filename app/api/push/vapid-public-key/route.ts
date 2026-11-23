import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type PushConfig = {
  public_key: string | null
}

export async function GET() {
  try {
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: rawData, error } = await admin.rpc('get_push_config').maybeSingle()
    const data = rawData as unknown as PushConfig | null
    if (error || !data?.public_key) return NextResponse.json({ error: 'Push notifications are not configured' }, { status: 503 })
    return NextResponse.json({ publicKey: data.public_key })
  } catch {
    return NextResponse.json({ error: 'Push notifications are not configured' }, { status: 503 })
  }
}
