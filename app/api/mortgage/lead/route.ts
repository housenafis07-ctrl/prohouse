import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { mortgagePrograms } from '@/lib/mortgage-programs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const programId = String(body.programId || '')
    const program = mortgagePrograms.find(p => p.id === programId)
    if (!program) return NextResponse.json({ error:'Ipoteka dasturi topilmadi.' },{status:400})
    const name = String(body.name || '').trim()
    const phone = String(body.phone || '').trim()
    const propertyPrice = Number(body.propertyPrice)
    const downPayment = Number(body.downPayment)
    const termMonths = Number(body.termMonths)
    const rate = Number(body.rate)
    const monthlyPayment = Number(body.monthlyPayment || 0)
    if (name.length < 2 || phone.length < 7 || !Number.isFinite(propertyPrice) || propertyPrice <= 0) return NextResponse.json({ error:'Ism, telefon va uy narxini to‘g‘ri kiriting.' },{status:400})
    if (!Number.isFinite(downPayment) || downPayment < 0 || !Number.isFinite(termMonths) || termMonths < 1) return NextResponse.json({ error:'Boshlang‘ich badal va muddatni tekshiring.' },{status:400})
    const admin = serviceClient()
    let listingId = typeof body.listingId === 'string' ? body.listingId : null
    if (listingId) {
      const { data: listing } = await admin.from('listings').select('id,price,is_mortgage_available,status').eq('id',listingId).maybeSingle()
      if (!listing || listing.status !== 'active' || !listing.is_mortgage_available) listingId = null
    }
    const { data, error } = await admin.from('mortgage_leads').insert({
      listing_id: listingId, market: program.markets.includes('secondary') && !program.markets.includes('primary') ? 'secondary' : (body.market === 'secondary' ? 'secondary' : 'primary'),
      program_id: program.id, bank_name: program.bank, program_name: program.program,
      customer_name: name, customer_phone: phone, property_price: propertyPrice,
      down_payment: downPayment, down_payment_percent: propertyPrice ? downPayment / propertyPrice * 100 : 0,
      term_months: termMonths, annual_rate: Number.isFinite(rate) ? rate : program.rateMin, monthly_payment: Number.isFinite(monthlyPayment) ? monthlyPayment : null,
    }).select('id').single()
    if (error) throw error
    return NextResponse.json({ ok:true, leadId:data.id })
  } catch (error) { return NextResponse.json({ error:error instanceof Error?error.message:'Ariza yuborilmadi.' },{status:500}) }
}
