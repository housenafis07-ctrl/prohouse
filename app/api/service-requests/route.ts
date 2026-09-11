import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const TYPES = new Set(['mortgage', 'insurance', 'legal', 'cadastral', 'property_service'])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Avval tizimga kiring.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || !TYPES.has(body.service_type)) {
    return NextResponse.json({ error: 'Xizmat turi noto‘g‘ri.' }, { status: 400 })
  }

  const requestedAmount = body.requested_amount == null || body.requested_amount === '' ? null : Number(body.requested_amount)
  const downPayment = body.down_payment == null || body.down_payment === '' ? null : Number(body.down_payment)
  const termMonths = body.term_months == null || body.term_months === '' ? null : Number(body.term_months)

  if (requestedAmount !== null && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) return NextResponse.json({ error: 'So‘ralgan summa noto‘g‘ri.' }, { status: 400 })
  if (downPayment !== null && (!Number.isFinite(downPayment) || downPayment < 0)) return NextResponse.json({ error: 'Dastlabki to‘lov noto‘g‘ri.' }, { status: 400 })
  if (termMonths !== null && (!Number.isInteger(termMonths) || termMonths <= 0)) return NextResponse.json({ error: 'Muddat noto‘g‘ri.' }, { status: 400 })

  const { data, error } = await supabase.from('service_requests').insert({
    user_id: user.id,
    listing_id: typeof body.listing_id === 'string' ? body.listing_id : null,
    service_type: body.service_type,
    requested_amount: requestedAmount,
    down_payment: downPayment,
    term_months: termMonths,
    contact_phone: typeof body.contact_phone === 'string' ? body.contact_phone.trim().slice(0, 32) || null : null,
    notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) || null : null,
  }).select('id,service_type,status,created_at').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data }, { status: 201 })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Avval tizimga kiring.' }, { status: 401 })
  const { data, error } = await supabase.from('service_requests').select('id,listing_id,service_type,status,requested_amount,down_payment,term_months,contact_phone,notes,created_at,updated_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data || [] })
}
