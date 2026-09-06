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

      const navActions = button.parentElement
      if (navActions) {
        let postLink = navActions.querySelector('.global-post-listing') as HTMLAnchorElement | null
        if (loggedIn) {
          if (!postLink) {
            postLink = document.createElement('a')
            postLink.className = 'global-post-listing'
            postLink.href = '/listings/new'
            postLink.textContent = 'E’lon joylashtirish'
            postLink.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;border-radius:12px;padding:10px 14px;background:#059669;color:#fff;font-size:12px;font-weight:800;text-decoration:none;'
            postLink.onmouseenter = () => { postLink!.style.background = '#047857' }
            postLink.onmouseleave = () => { postLink!.style.background = '#059669' }
            navActions.insertBefore(postLink, button)
          }
        } else if (postLink) {
          postLink.remove()
        }
      }

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
