'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function GlobalNavigationFix() {
  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    let currentUserId: string | null = null

    const applyNavigation = () => {
      if (!mounted) return
      const button = document.querySelector('.account-btn') as HTMLButtonElement | null
      if (!button) return

      const loggedIn = Boolean(currentUserId)
      const desiredText = loggedIn ? 'Chiqish' : 'Kirish / Ro‘yxatdan o‘tish'

      if (button.textContent !== desiredText) button.textContent = desiredText

      const desiredAction = loggedIn ? 'logout' : 'login'
      if (button.dataset.authAction === desiredAction) return

      button.dataset.authAction = desiredAction

      if (loggedIn) {
        button.onclick = async (event) => {
          event.preventDefault()
          const { error } = await supabase.auth.signOut()
          if (error) console.error('Logout failed:', error)
        }
      } else {
        // This is a <button>, not an <a>, so setting href does not navigate.
        // Use a real browser navigation for the login/register route.
        button.onclick = (event) => {
          event.preventDefault()
          window.location.assign('/register')
        }
      }
    }

    const syncAuthState = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      currentUserId = user?.id ?? null
      applyNavigation()
    }

    const observer = new MutationObserver(() => applyNavigation())
    observer.observe(document.body, { childList: true, subtree: true })

    void syncAuthState()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      currentUserId = session?.user?.id ?? null
      applyNavigation()
    })

    return () => {
      mounted = false
      observer.disconnect()
      listener.subscription.unsubscribe()
    }
  }, [])

  return null
}
