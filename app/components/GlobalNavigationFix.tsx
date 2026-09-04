'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GlobalNavigationFix() {
  const router = useRouter()

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const accountButton = target?.closest('.account-btn')
      if (!accountButton) return
      event.preventDefault()
      router.push('/register')
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [router])

  return null
}
