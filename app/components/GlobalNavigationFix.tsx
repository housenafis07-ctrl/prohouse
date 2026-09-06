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

      // On the homepage the secondary authenticated action is the cabinet.
      // Logout stays inside the cabinet so the two homepage buttons have clear purposes:
      // 1) E’lon joylashtirish, 2) Shaxsiy kabinet.
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

      // The personal cabinet must also have a clearly visible listing action.
      // Inject it into the existing “Keyingi qadamlar” block without replacing
      // the React-rendered account UI.
      if (loggedIn && window.location.pathname === '/account') {
        const existing = document.querySelector('.account-post-listing') as HTMLAnchorElement | null
        if (!existing) {
          const heading = Array.from(document.querySelectorAll('h2')).find(h => h.textContent?.trim() === 'Keyingi qadamlar')
          const section = heading?.closest('section')
          const container = section?.querySelector('div.mt-4')
          if (container) {
            const link = document.createElement('a')
            link.className = 'account-post-listing'
            link.href = '/listings/new'
            link.textContent = 'E’lon joylashtirish'
            link.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;border:1px solid #a7f3d0;border-radius:16px;padding:16px;background:#ecfdf5;color:#065f46;font-size:14px;font-weight:800;text-decoration:none;margin-bottom:12px;'
            link.onmouseenter = () => { link.style.background = '#d1fae5' }
            link.onmouseleave = () => { link.style.background = '#ecfdf5' }
            const icon = document.createElement('span')
            icon.textContent = '+'
            icon.style.cssText = 'display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:#d1fae5;color:#059669;font-size:22px;font-weight:900;flex:none;'
            const text = document.createElement('span')
            text.innerHTML = '<span style="display:block">E’lon joylashtirish</span><span style="display:block;margin-top:3px;font-size:12px;font-weight:500;color:#047857">Mulkingizni Prohouse’da soting yoki ijaraga bering.</span>'
            link.textContent = ''
            link.appendChild(icon)
            link.appendChild(text)
            container.insertBefore(link, container.firstChild)
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
