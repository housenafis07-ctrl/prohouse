import type { ReactNode } from 'react'
import ListingDetailLanguageFix from './ListingDetailLanguageFix'

export default function ListingDetailLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ListingDetailLanguageFix />
    </>
  )
}
