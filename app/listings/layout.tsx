import { Suspense, type ReactNode } from 'react'

export default function ListingsLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#f6f7f8]" />}>{children}</Suspense>
}
