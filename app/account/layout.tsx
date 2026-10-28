'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import MobileAccountMenu from './MobileAccountMenu'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // The account page currently has its own client-side auth/profile loader.
    // If that loader is blocked by a stale Supabase auth lock, do not leave
    // the user on an infinite "Yuklanmoqda..." screen.
    if (pathname !== '/account') return

    const timer = window.setTimeout(() => {
      router.replace('/account/login?next=%2Faccount')
    }, 10000)

    return () => window.clearTimeout(timer)
  }, [pathname, router])

  return <><MobileAccountMenu />{children}</>
}
