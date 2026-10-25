'use client'

import { useEffect } from 'react'

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

export default function ServiceListingDetailPolish() {
  useEffect(() => {
    if (!/^\/listings\/[^/]+\/?$/.test(window.location.pathname)) return

    const hideServiceType = () => {
      const labels = Array.from(document.querySelectorAll<HTMLElement>('div,span,p,dt'))
      for (const label of labels) {
        const labelText = normalize(label.textContent || '')
        if (labelText !== 'mulk turi' && labelText !== 'тип недвижимости') continue

        let node: HTMLElement | null = label
        for (let depth = 0; depth < 4 && node; depth += 1) {
          const text = normalize(node.textContent || '')
          if (text === 'mulk turi service' || text === 'тип недвижимости service') {
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
    return () => observer.disconnect()
  }, [])

  return null
}
