import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ListingDetailClient from '@/app/listings/[id]/ListingDetailClient'
import ListingOwnerStats, { type ListingOwnerStatsData } from '@/app/listings/[id]/ListingOwnerStats'
import { getListingCardImageUrl } from '@/lib/listing-image'

export default async function OwnerListingViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/register?redirect=/account/listings/${encodeURIComponent(id)}/view`)

  const { data, error } = await supabase
    .from('listings')
    .select('id,owner_id,title,title_ru,description,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,address,latitude,longitude,taxonomy_code,seller_type,seller_name,seller_phone,is_mortgage_available,is_verified,is_trusted_seller,is_featured,promotion_badge,promoted_until,published_at,draft_data,listing_images(image_url,sort_order)')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (error || !data) notFound()

  const images = (data.listing_images || [])
    .slice()
    .sort((a: { sort_order: number | null }, b: { sort_order: number | null }) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((image: { image_url: string; sort_order: number | null }) => ({
      ...image,
      image_url: getListingCardImageUrl(image.image_url),
    }))

  const { data: events } = await supabase
    .from('listing_events')
    .select('event_type,user_id,session_id,created_at')
    .eq('listing_id', id)
    .in('event_type', ['view', 'share', 'phone_click', 'chat_start'])

  const rows = events || []
  const uniqueKeys = new Set<string>()
  let views = 0
  let shares = 0
  let phoneClicks = 0
  let chatStarts = 0
  let todayViews = 0
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  for (const event of rows) {
    if (event.event_type === 'view') {
      const key = event.session_id || (event.user_id ? `user:${event.user_id}` : `event:${event.created_at}`)
      uniqueKeys.add(key)
      views += 1
      if (new Date(event.created_at) >= todayStart) todayViews += 1
    } else if (event.event_type === 'share') shares += 1
    else if (event.event_type === 'phone_click') phoneClicks += 1
    else if (event.event_type === 'chat_start') chatStarts += 1
  }

  const ownerStats: ListingOwnerStatsData = {
    views,
    uniqueViews: uniqueKeys.size,
    todayViews,
    shares,
    phoneClicks,
    chatStarts,
  }

  const price = new Intl.NumberFormat('uz-UZ').format(Number(data.price))
  const priceLabel = data.currency === 'USD' ? `$${price}` : `${price} so‘m`

  return (
    <>
      <ListingDetailClient listing={{ ...(data as any), listing_images: images }} />
      <ListingOwnerStats listingId={id} title={data.title} priceLabel={priceLabel} initialStats={ownerStats} />
    </>
  )
}
