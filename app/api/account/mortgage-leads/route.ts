import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

export async function GET() {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const db = serviceClient()
    const { data, error } = await db
      .from('mortgage_leads')
      .select('id,listing_id,market,bank_name,program_name,property_price,down_payment,term_months,annual_rate,monthly_payment,status,created_at,updated_at,listing:listings(id,title,title_ru,price)')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ leads: data || [] })
  } catch (error) {
    console.error('[Account mortgage leads]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ipoteka arizalarini yuklab bo‘lmadi.' }, { status: 500 })
  }
}
