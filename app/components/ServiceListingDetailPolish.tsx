'use client'

import { useEffect } from 'react'

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function isServiceListingPage() {
  return /^\/listings\/[^/]+\/?$/.test(window.location.pathname)
}

export default function ServiceListingDetailPolish() {
  useEffect(() => {
    if (!isServiceListingPage()) return

    const hideServiceTypeRow = () => {
      const all = Array.from(document.querySelectorAll<HTMLElement>('div, span, p, dt, dd'))

      // The service detail card renders the property-type field as a label/value
      // pair. Hide the whole row only when its value is exactly `service`.
      for (const label of all) {
        const labelText = normalize(label.textContent || '')
        if (labelText !== 'mulk turi' && labelText !== 'тип недвижимости') continue

        // Most importantly, do not hide the label alone. Hide its containing
        // row so neither "Mulk turi" nor the value "service" remains visible.
        const directParent = label.parentElement
        if (directParent) {
          const parentText = normalize(directParent.textContent || '')
          const hasServiceValue = Array.from(directParent.querySelectorAll<HTMLElement>('div, span, p, dt, dd'))
            .some((item) => item !== label && normalize(item.textContent || '') === 'service')
          if (hasServiceValue || parentText === 'mulk turi service' || parentText === 'тип недвижимости service') {
            directParent.style.setProperty('display', 'none', 'important')
            directParent.setAttribute('data-rh-service-type-hidden', 'true')
            continue
          }
        }

        // Fallback for layouts where the label and value are wrapped in
        // different elements: locate the nearest small ancestor containing
        // both exact strings, rather than hiding a large page section.
        let node = directParent
        for (let depth = 0; depth < 6 && node; depth += 1) {
          const text = normalize(node.textContent || '')
          const hasLabel = text.includes('mulk turi') || text.includes('тип недвижимости')
          const hasService = text.includes('service')
          if (hasLabel && hasService && text.length < 300) {
            node.style.setProperty('display', 'none', 'important')
            node.setAttribute('data-rh-service-type-hidden', 'true')
            break
          }
          node = node.parentElement
        }
      }
    }

    hideServiceTypeRow()

    const observer = new MutationObserver(hideServiceTypeRow)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return null
}
