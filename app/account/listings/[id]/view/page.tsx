import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'
import ListingDetailClient from '@/app/listings/[id]/ListingDetailClient'
import ListingOwnerStats from '@/app/listings/[id]/ListingOwnerStats'
import { getListingCardImageUrl } from '@/lib/listing-image'

export const dynamic = 'force-dynamic'

export default async function OwnerListingViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) redirect(`/register?redirect=/account/listings/${encodeURIComponent(id)}/view`)

  // Phone-backed RoyalHouse accounts use the signed first-party cookie, not
  // necessarily a Supabase Auth session. Use the service client only after
  // verifying that cookie, and always constrain the listing to its owner.
  const admin = serviceClient()
  const { data, error } = await admin
    .from('listings')
    .select('id,owner_id,title,title_ru,description,listing_type,property_type,status,price,currency,area_m2,rooms,floor,floors_total,district,city,address,latitude,longitude,taxonomy_code,seller_type,seller_name,seller_phone,is_mortgage_available,is_verified,is_trusted_seller,is_featured,promotion_badge,promoted_until,published_at,draft_data,listing_images(image_url,sort_order)')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[OwnerListingViewPage] listing lookup failed', { listingId: id, error })
    notFound()
  }
  if (!data) notFound()

  const images = (data.listing_images || [])
    .slice()
    .sort((a: { sort_order: number | null }, b: { sort_order: number | null }) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((image: { image_url: string; sort_order: number | null }) => ({
      ...image,
      image_url: getListingCardImageUrl(image.image_url),
    }))

  return (
    <>
      <ListingDetailClient listing={{ ...(data as any), listing_images: images }} isOwner />
      <ListingOwnerStats listingId={id} />
    </>
  )
}
