import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const { data, error } = await supabase
    .from('listings')
    .select('id,title,title_ru,price,city,district,status,listing_images(image_url,sort_order)')
    .eq('owner_id', user.id)
    .in('status', ['active', 'moderation'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const listings = (data ?? []).map((listing) => {
    const images = Array.isArray(listing.listing_images) ? listing.listing_images : []
    const primary = images
      .filter((image) => image && typeof image === 'object')
      .sort((a, b) => Number(a?.sort_order ?? 999) - Number(b?.sort_order ?? 999))[0]

    return {
      id: listing.id,
      title: listing.title,
      title_ru: listing.title_ru,
      price: listing.price,
      city: listing.city,
      district: listing.district,
      status: listing.status,
      image_url: primary?.image_url ?? null,
    }
  })

  return NextResponse.json({ listings })
}
