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
      // The detail card is rendered by ListingDetailClient. For service
      // listings its property-type field is a small card containing:
      //   <span>Mulk turi</span><b>service</b>
      // (or the Russian equivalent for the label). Target the VALUE first;
      // this is much more reliable than guessing a parent from text selectors.
      const serviceValues = Array.from(document.querySelectorAll<HTMLElement>('b')).filter(
        (element) => normalize(element.textContent || '') === 'service',
      )

      for (const value of serviceValues) {
        // The field card is the closest ancestor that contains the label and
        // the service value but is still small enough not to hide the entire
        // listing panel.
        let node: HTMLElement | null = value.parentElement

        for (let depth = 0; depth < 5 && node; depth += 1) {
          const text = normalize(node.textContent || '')
          const hasUzLabel = text.includes('mulk turi')
          const hasRuLabel = text.includes('тип недвижимости')
          const hasOnlyServiceField =
            (hasUzLabel || hasRuLabel) &&
            text.includes('service') &&
            text.length <= 80

          if (hasOnlyServiceField) {
            node.style.setProperty('display', 'none', 'important')
            node.setAttribute('data-rh-service-type-hidden', 'true')
            break
          }

          node = node.parentElement
        }
      }

      // Fallback for a future markup variant where the value is not a <b>.
      const labels = Array.from(document.querySelectorAll<HTMLElement>('span,div,p,dt,dd')).filter((element) => {
        const text = normalize(element.textContent || '')
        return text === 'mulk turi' || text === 'тип недвижимости'
      })

      for (const label of labels) {
        let node: HTMLElement | null = label.parentElement
        for (let depth = 0; depth < 4 && node; depth += 1) {
          const text = normalize(node.textContent || '')
          if ((text === 'mulk turi service' || text === 'тип недвижимости service') && text.length < 80) {
            node.style.setProperty('display', 'none', 'important')
            node.setAttribute('data-rh-service-type-hidden', 'true')
            break
          }
          node = node.parentElement
        }
      }
    }

    hideServiceTypeRow()

    // The detail UI can be hydrated/translated after this component mounts.
    // Re-run when React or the language runtime changes the DOM.
    const observer = new MutationObserver(hideServiceTypeRow)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [])

  return null
}
