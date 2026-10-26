'use client'

import { useEffect } from 'react'

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

export default function ServiceListingDetailPolish() {
  useEffect(() => {
    const hideServiceType = () => {
      if (!/^\/listings\/[^/]+\/?$/.test(window.location.pathname)) return

      const labels = Array.from(document.querySelectorAll<HTMLElement>('div,span,p,dt'))
      for (const label of labels) {
        const text = normalize(label.textContent || '')
        if (text !== 'mulk turi' && text !== 'тип недвижимости') continue

        let node: HTMLElement | null = label
        for (let depth = 0; depth < 8 && node; depth += 1) {
          const hasServiceValue = Array.from(
            node.querySelectorAll<HTMLElement>('div,span,p,dd,dt')
          ).some((item) => normalize(item.textContent || '') === 'service')
            || normalize(node.textContent || '').includes('mulk turi service')
            || normalize(node.textContent || '').includes('тип недвижимости service')

          if (hasServiceValue) {
            node.style.display = 'none'
            break
          }
          node = node.parentElement
        }
      }
    }

    hideServiceType()

    const observer = new MutationObserver(hideServiceType)
    observer.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('popstate', hideServiceType)

    return () => {
      observer.disconnect()
      window.removeEventListener('popstate', hideServiceType)
    }
  }, [])

  return null
}
