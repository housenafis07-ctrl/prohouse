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

      const loggedIn = Boolean(currentUserId)
      const bodyText = document.body?.innerText || ''
      const isRussian = bodyText.includes('Купить') || bodyText.includes('Недвижимость') || bodyText.includes('Найдите дом мечты')

      // The header has ONE real listing action: the small top-right
      // "Разместить объявление" / "E’lon joylashtirish" link.
      // The previously injected green duplicate must never exist.
      document.querySelectorAll('.global-post-listing').forEach((el) => el.remove())

      // Make the existing top listing link functional without creating another button.
      const listingLinks = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[]
      const topListingLink = listingLinks.find((link) => {
        const text = link.textContent?.trim() || ''
        return text === 'Разместить объявление' || text === 'E’lon joylashtirish'
      })
      if (topListingLink) {
        topListingLink.href = '/listings/new'
        topListingLink.onclick = () => {
          window.location.assign('/listings/new')
        }
      }

      const button = document.querySelector('.account-btn') as HTMLButtonElement | null
      if (button) {
        const desiredText = loggedIn
          ? (isRussian ? 'Личный кабинет' : 'Shaxsiy kabinet')
          : (isRussian ? 'Войти / Регистрация' : 'Kirish / Ro‘yxatdan o‘tish')

        if (button.textContent !== desiredText) button.textContent = desiredText

        const desiredAction = loggedIn ? 'account' : 'login'
        if (button.dataset.authAction !== desiredAction) {
          button.dataset.authAction = desiredAction
          button.onclick = (event) => {
            event.preventDefault()
            window.location.assign(loggedIn ? '/account' : '/register')
          }
        }
      }

      // The cabinet itself gets one clear listing action under "Keyingi qadamlar".
      // This does not create a duplicate in the global header.
      if (loggedIn && window.location.pathname === '/account') {
        const existing = document.querySelector('.account-post-listing') as HTMLAnchorElement | null
        if (!existing) {
          const heading = Array.from(document.querySelectorAll('h2')).find(
            (h) => h.textContent?.trim() === 'Keyingi qadamlar' || h.textContent?.trim() === 'Следующие шаги'
          )
          const section = heading?.closest('section')
          const container = section?.querySelector('div.mt-4')
          if (container) {
            const link = document.createElement('a')
            link.className = 'account-post-listing'
            link.href = '/listings/new'
            link.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;border:1px solid #a7f3d0;border-radius:16px;padding:16px;background:#ecfdf5;color:#065f46;font-size:14px;font-weight:800;text-decoration:none;margin-bottom:12px;'

            const icon = document.createElement('span')
            icon.textContent = '+'
            icon.style.cssText = 'display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:#d1fae5;color:#059669;font-size:22px;font-weight:900;flex:none;'

            const text = document.createElement('span')
            text.innerHTML = isRussian
              ? '<span style="display:block">Разместить объявление</span><span style="display:block;margin-top:3px;font-size:12px;font-weight:500;color:#047857">Продайте или сдайте недвижимость на Prohouse.</span>'
              : '<span style="display:block">E’lon joylashtirish</span><span style="display:block;margin-top:3px;font-size:12px;font-weight:500;color:#047857">Mulkingizni Prohouse’da soting yoki ijaraga bering.</span>'

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
