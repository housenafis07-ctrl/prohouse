import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const { id } = await params
  const { data, error } = await supabase.from('monetization_orders')
    .select('id,order_code,status,amount_uzs,currency,product_id,listing_id,payment_provider,provider_payment_id,paid_at,created_at,updated_at')
    .eq('id', id).eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ order: data })
}
