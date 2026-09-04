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
      const button = document.querySelector('.account-btn') as HTMLAnchorElement | HTMLButtonElement | null
      if (!button) return

      const loggedIn = Boolean(currentUserId)
      const desiredText = loggedIn ? 'Chiqish' : 'Kirish / Ro‘yxatdan o‘tish'
      const desiredHref = loggedIn ? '#' : '/register'

      // Only mutate the DOM when something actually changed. This is
      // important because the observer watches the same DOM we update.
      if (button.textContent !== desiredText) button.textContent = desiredText
      if (button.getAttribute('href') !== desiredHref) button.setAttribute('href', desiredHref)

      if (loggedIn) {
        if (button.dataset.authAction !== 'logout') {
          button.dataset.authAction = 'logout'
          button.onclick = async (event) => {
            event.preventDefault()
            const { error } = await supabase.auth.signOut()
            if (error) console.error('Logout failed:', error)
          }
        }
      } else {
        if (button.dataset.authAction !== 'login') {
          button.dataset.authAction = 'login'
          button.onclick = null
        }
      }
    }

    const syncAuthState = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      currentUserId = user?.id ?? null
      applyNavigation()
    }

    // The header may mount after this component. Observe only for the
    // appearance/replacement of the account button, while applyNavigation
    // avoids writing unchanged DOM values and therefore cannot loop forever.
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
