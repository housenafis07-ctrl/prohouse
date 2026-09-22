'use client'

import { useLayoutEffect } from 'react'

export default function RoyalhouseFooterFix() {
  useLayoutEffect(() => {
    const apply = () => {
      const footer = document.querySelector<HTMLElement>('main > footer')
      if (!footer) return false

      footer.style.backgroundColor = '#06232d'
      footer.style.color = '#ffffff'
      footer.style.borderTop = '0'
      footer.style.padding = '0'

      const inner = footer.firstElementChild as HTMLElement | null
      if (inner) {
        inner.style.paddingTop = '48px'
        inner.style.paddingBottom = '24px'
      }

      const brand = footer.querySelector<HTMLElement>('b')
      if (brand) {
        brand.innerHTML = 'Royal<span style="color:#08d878">house</span>'
        brand.style.color = '#ffffff'
        brand.style.fontSize = '20px'
        brand.style.fontWeight = '800'
        brand.style.letterSpacing = '-0.04em'
      }

      footer.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
        link.style.color = '#ffffff'
        link.style.textDecoration = 'none'
        link.style.fontWeight = '600'
      })

      const copyright = footer.querySelector('p') as HTMLElement | null
      if (copyright) {
        copyright.innerHTML = '© 2026 Royalhouse. Barcha huquqlar himoyalangan.'
        copyright.style.color = '#9bb0ba'
      }

      return true
    }

    if (apply()) return

    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect()
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
