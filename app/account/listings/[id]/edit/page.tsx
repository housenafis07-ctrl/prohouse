import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import EditListingWizard from './EditListingWizard'
import EditListingLanguageFix from './EditListingLanguageFix'
import ServiceEditListingWizard from './ServiceEditListingWizard'

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/register?redirect=/account/listings/${encodeURIComponent(id)}/edit`)

  const { data: listing, error } = await supabase
    .from('listings')
    .select('id,listing_type,property_type,taxonomy_code')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (error || !listing) notFound()

  const isService = listing.listing_type === 'service' || listing.property_type === 'service'
  if (isService) return <ServiceEditListingWizard />

  return <><EditListingLanguageFix /><EditListingWizard /></>
}
