import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

export async function GET(request: NextRequest) {
  const market = request.nextUrl.searchParams.get('market') === 'primary' ? 'primary' : 'secondary'
  try {
    const admin = serviceClient()
    const { data, error } = await admin
      .from('listings')
      .select('id,title,title_ru,price,currency,city,district,latitude,longitude,property_type,listing_type,is_mortgage_available')
      .eq('status','active')
      .eq('is_mortgage_available',true)
      .not('latitude','is',null)
      .not('longitude','is',null)
      .order('published_at',{ascending:false})
      .limit(100)
    if (error) throw error
    const listings = (data || []).filter((item:any) => {
      const primary = item.listing_type === 'new_building' || item.property_type === 'new_building'
      return market === 'primary' ? primary : !primary
    })
    return NextResponse.json({ listings })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Obyektlar yuklanmadi.' }, { status:500 })
  }
}
