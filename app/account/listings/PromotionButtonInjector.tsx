'use client'

import { useEffect } from 'react'
import { useI18n } from '@/app/components/I18nProvider'

/**
 * Adds the promotion action directly after the listing's "Close" action.
 * The listing page is already a large client component, so keeping this
 * small UI concern isolated avoids duplicating its data-loading logic.
 */
export default function PromotionButtonInjector() {
  const { lang } = useI18n()

  useEffect(() => {
    const selector = 'article button'
    let observer: MutationObserver | null = null

    const inject = () => {
      document.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
        const label = button.textContent?.trim()
        if (label !== 'Yopish' && label !== 'Закрыть') return
        if (button.dataset.promotionButtonAttached === 'true') return

        const link = document.createElement('a')
        link.href = '/account/monetization/checkout'
        link.dataset.listingPromotionButton = 'true'
        link.className = 'inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-100 px-4 py-2.5 text-sm font-extrabold text-amber-900 shadow-sm transition hover:bg-amber-200 hover:border-amber-400 active:scale-[.98]'
        link.textContent = lang === 'ru' ? '⭐ Продвинуть' : '⭐ Ilgari surish'
        link.title = lang === 'ru' ? 'Выбрать тариф продвижения' : 'Ilgari surish tarifini tanlash'

        button.dataset.promotionButtonAttached = 'true'
        button.insertAdjacentElement('afterend', link)
      })
    }

    inject()
    observer = new MutationObserver(inject)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer?.disconnect()
  }, [lang])

  return null
}
