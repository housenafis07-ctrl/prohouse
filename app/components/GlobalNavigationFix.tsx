'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function GlobalNavigationFix() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    let currentUserId: string | null = null
    let syncing = false

    const applyNavigation = () => {
      if (!mounted || syncing) return
      const button = document.querySelector('.account-btn') as HTMLAnchorElement | HTMLButtonElement | null
      if (!button) return

      syncing = true
      try {
        if (currentUserId) {
          // Logged-in state: the homepage button is the logout action.
          button.textContent = 'Chiqish'
          button.setAttribute('href', '#')
          button.onclick = async (event) => {
            event.preventDefault()
            await supabase.auth.signOut()
          }
        } else {
          // Logged-out state: route to the phone login/registration page.
          button.textContent = 'Kirish / Ro‘yxatdan o‘tish'
          button.setAttribute('href', '/register')
          button.onclick = (event) => {
            event.preventDefault()
            router.push('/register')
          }
        }
      } finally {
        syncing = false
      }
    }

    const syncAuthState = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      currentUserId = user?.id ?? null
      applyNavigation()
    }

    // The header can mount after this component. Observe the DOM so the
    // account button changes immediately, without requiring F5.
    const observer = new MutationObserver(() => applyNavigation())
    observer.observe(document.body, { childList: true, subtree: true })

    void syncAuthState()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      currentUserId = session?.user?.id ?? null
      applyNavigation()
    })

    // Also catch the case where the header is replaced during client routing.
    const interval = window.setInterval(applyNavigation, 500)

    return () => {
      mounted = false
      observer.disconnect()
      window.clearInterval(interval)
      listener.subscription.unsubscribe()
    }
  }, [router])

  return null
}
