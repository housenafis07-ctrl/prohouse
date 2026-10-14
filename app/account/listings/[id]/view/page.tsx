import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ListingDetailClient from '@/app/listings/[id]/ListingDetailClient'
import { getListingCardImageUrl } from '@/lib/listing-image'

export default async function OwnerListingViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/register?redirect=/account/listings/${encodeURIComponent(id)}/view`)

  const { data, error } = await supabase
    .from('listings')
    .select('id,owner_id,status,title,title_ru,description,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,address,latitude,longitude,taxonomy_code,seller_type,seller_name,seller_phone,is_mortgage_available,is_verified,is_trusted_seller,is_featured,promotion_badge,promoted_until,published_at,draft_data,listing_images(image_url,sort_order)')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) notFound()

  // The owner route must never expose another user's draft/rejected listing.
  // For an active listing, however, fall back to the canonical public page
  // instead of producing a false 404 when the public listing is already valid.
  if (data.owner_id !== user.id) {
    if (data.status === 'active') redirect(`/listings/${encodeURIComponent(id)}`)
    notFound()
  }

  const images = (data.listing_images || [])
    .slice()
    .sort((a: { sort_order: number | null }, b: { sort_order: number | null }) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((image: { image_url: string; sort_order: number | null }) => ({
      ...image,
      image_url: getListingCardImageUrl(image.image_url),
    }))

  return <ListingDetailClient listing={{ ...(data as any), listing_images: images }} />
}
