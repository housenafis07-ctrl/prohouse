'use client'

import { useI18n } from '@/app/components/I18nProvider'
import ListingDetailReviews from './ListingDetailReviews'

export default function ListingDetailReviewsMount({ listingId }: { listingId: string }) {
  const { lang } = useI18n()
  return <ListingDetailReviews listingId={listingId} lang={lang} />
}
