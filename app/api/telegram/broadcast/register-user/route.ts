import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-secret')
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const user = body?.message?.from || body?.callback_query?.from
  if (!user?.id) return NextResponse.json({ ok: true })

  const supabase = await createClient()
  const { error } = await supabase.from('telegram_bot_users').upsert({
    telegram_id: String(user.id),
    username: user.username || null,
    first_name: user.first_name || null,
    language_code: user.language_code || null,
    is_active: true,
    last_interaction_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'telegram_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
