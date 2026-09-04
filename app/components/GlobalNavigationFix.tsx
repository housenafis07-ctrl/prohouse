'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function GlobalNavigationFix() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const syncNavigation = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return

      const button = document.querySelector('.account-btn') as HTMLElement | null
      if (!button) return

      const oldLogout = document.querySelector('.global-logout-btn')
      if (oldLogout) oldLogout.remove()

      if (user) {
        // Authenticated state: show a clear logout action on the homepage.
        button.textContent = 'Chiqish'
        button.setAttribute('href', '#')
        button.onclick = async (event) => {
          event.preventDefault()
          await supabase.auth.signOut()
          router.refresh()
          await syncNavigation()
        }
      } else {
        button.textContent = 'Kirish / Ro‘yxatdan o‘tish'
        button.setAttribute('href', '/register')
        button.onclick = (event) => {
          event.preventDefault()
          router.push('/register')
        }
      }
    }

    void syncNavigation()
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void syncNavigation()
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [router])

  return null
}
