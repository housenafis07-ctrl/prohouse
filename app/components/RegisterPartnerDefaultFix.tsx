'use client'

import { useEffect } from 'react'

/**
 * The partner landing CTA intentionally links to /register?type=partner.
 * Keep that intent when the registration form is rendered without changing
 * the existing registration component/state architecture.
 */
export default function RegisterPartnerDefaultFix() {
  useEffect(() => {
    if (window.location.pathname !== '/register') return

    const params = new URLSearchParams(window.location.search)
    if (params.get('type') !== 'partner') return

    const activatePartner = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      const button = buttons.find((item) => {
        const text = item.textContent?.trim()
        return text === 'Hamkor' || text === 'Партнёр'
      })
      if (!button) return false

      if (!button.className.includes('text-emerald-700')) button.click()
      return true
    }

    if (activatePartner()) return

    const observer = new MutationObserver(() => {
      if (activatePartner()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [])

  return null
}
