import type { ReactNode } from 'react'
import ListingDetailLanguageFix from './ListingDetailLanguageFix'
import MobileListingActions from './MobileListingActions'

export default function ListingDetailLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ListingDetailLanguageFix />
      <MobileListingActions />
    </>
  )
}
