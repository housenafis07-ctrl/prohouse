'use client'

import { useEffect } from 'react'

/**
 * Partner CTA opens /register?type=partner.
 * Keep the existing registration architecture intact, but make the partner
 * intent explicit from the first screen and select the Partner account type
 * after phone verification.
 */
export default function RegisterPartnerDefaultFix() {
  useEffect(() => {
    if (window.location.pathname !== '/register') return

    const params = new URLSearchParams(window.location.search)
    if (params.get('type') !== 'partner') return

    const applyPartnerMode = () => {
      const headings = Array.from(document.querySelectorAll<HTMLElement>('h1'))
      const heading = headings.find((item) => /Royalhouse|Вход/.test(item.textContent || ''))
      if (heading) {
        const isRu = document.documentElement.lang === 'ru' || /Вход|Партн/.test(heading.textContent || '')
        heading.textContent = isRu ? 'Регистрация как партнёр' : 'Hamkor sifatida ro‘yxatdan o‘tish'

        const card = heading.parentElement
        if (card && !card.querySelector('[data-royalhouse-partner-mode="1"]')) {
          const badge = document.createElement('div')
          badge.setAttribute('data-royalhouse-partner-mode', '1')
          badge.textContent = isRu ? 'Партнёрский аккаунт' : 'Hamkor akkaunti'
          badge.style.cssText = 'display:inline-flex;align-items:center;margin-top:10px;border-radius:999px;background:#ecfdf5;color:#047857;padding:6px 10px;font-size:12px;font-weight:800'
          card.insertBefore(badge, heading.nextSibling)
        }

        const paragraph = card?.querySelector('p')
        if (paragraph && !paragraph.textContent?.includes('Telefon raqamingiz tasdiqlandi')) {
          paragraph.textContent = isRu
            ? 'Продолжите с подтверждением номера телефона для партнёрского аккаунта.'
            : 'Hamkor akkaunti uchun telefon raqamingizni tasdiqlashdan davom eting.'
        }
      }

      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      const partnerButton = buttons.find((item) => {
        const text = item.textContent?.trim()
        return text === 'Hamkor' || text === 'Партнёр'
      })

      if (partnerButton) {
        const selected = partnerButton.className.includes('text-emerald-700') || partnerButton.className.includes('bg-white')
        if (!selected) partnerButton.click()
        return true
      }

      return false
    }

    applyPartnerMode()
    const observer = new MutationObserver(() => applyPartnerMode())
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [])

  return null
}
