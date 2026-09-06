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
      // On the public homepage the second action is the user's cabinet,
      // not logout. Logout remains available inside the cabinet itself.
      const desiredText = loggedIn ? 'Shaxsiy kabinet' : 'Kirish / Ro‘yxatdan o‘tish'
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

      const desiredAction = loggedIn ? 'account' : 'login'
      if (button.dataset.authAction !== desiredAction) {
        button.dataset.authAction = desiredAction
        if (loggedIn) {
          button.onclick = (event) => {
            event.preventDefault()
            window.location.assign('/account')
          }
        } else {
          button.onclick = (event) => {
            event.preventDefault()
            window.location.assign('/register')
          }
        }
      }

      // The account page should also expose the primary seller action.
      if (loggedIn && window.location.pathname === '/account') {
        const accountLink = document.querySelector('.account-post-listing') as HTMLAnchorElement | null
        if (!accountLink) {
          const candidates = Array.from(document.querySelectorAll('a'))
          const cabinetLink = candidates.find(a => a.textContent?.trim() === 'Kabinet' || a.getAttribute('href') === '/account')
          if (cabinetLink?.parentElement) {
            const link = document.createElement('a')
            link.className = 'account-post-listing'
            link.href = '/listings/new'
            link.textContent = 'E’lon joylashtirish'
            link.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;border-radius:12px;padding:8px 12px;background:#059669;color:#fff;font-size:13px;font-weight:800;text-decoration:none;margin-left:10px;'
            link.onmouseenter = () => { link.style.background = '#047857' }
            link.onmouseleave = () => { link.style.background = '#059669' }
            cabinetLink.parentElement.appendChild(link)
          }
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
