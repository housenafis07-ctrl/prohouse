import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error:'listing id required' },{status:400})
  try {
    const admin = serviceClient()
    const { data, error } = await admin.from('listings').select('id,title,title_ru,price,currency,listing_type,property_type,is_mortgage_available').eq('id',id).eq('status','active').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error:'E’lon topilmadi.' },{status:404})
    if (!data.is_mortgage_available) return NextResponse.json({ error:'Bu e’lon ipotekaga mos deb belgilanmagan.' },{status:400})
    return NextResponse.json({ listing:data })
  } catch (error) { return NextResponse.json({ error:error instanceof Error?error.message:'E’lon yuklanmadi.' },{status:500}) }
}
