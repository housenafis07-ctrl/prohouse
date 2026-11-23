import { Suspense, type ReactNode } from 'react'
import ListingImagePerformance from './ListingImagePerformance'

export default function ListingsLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#f6f7f8]" />}><ListingImagePerformance />{children}</Suspense>
}
