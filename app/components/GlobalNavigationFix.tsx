'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function GlobalNavigationFix() {
  const router = useRouter()

  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const accountButton = target?.closest('.account-btn')
      if (!accountButton) return
      event.preventDefault()

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      router.push(user ? '/account' : '/register')
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [router])

  return null
}
