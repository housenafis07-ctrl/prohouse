'use client'

import { useEffect } from 'react'

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()

export default function ServiceListingDetailPolish() {
  useEffect(() => {
    if (!/^\/listings\/[^/]+\/?$/.test(window.location.pathname)) return

    const hideServicePropertyTypeCard = () => {
      // ListingDetailClient renders the metadata area as:
      // .mt-6.grid.grid-cols-2.gap-3 > .rounded-xl.bg-slate-50.p-3
      // A service listing has property_type="service" and its card is the
      // card containing <span>Mulk turi</span><b>service</b>.
      const grids = Array.from(document.querySelectorAll<HTMLElement>('.mt-6.grid.grid-cols-2.gap-3'))

      for (const grid of grids) {
        const cards = Array.from(grid.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement,
        )

        for (const card of cards) {
          const label = card.querySelector<HTMLElement>('span')
          const value = card.querySelector<HTMLElement>('b')
          if (!label || !value) continue

          const labelText = normalize(label.textContent || '')
          const valueText = normalize(value.textContent || '')
          const isPropertyType = labelText === 'mulk turi' || labelText === 'тип недвижимости'

          if (isPropertyType && valueText === 'service') {
            card.style.setProperty('display', 'none', 'important')
            card.setAttribute('data-rh-service-property-type-hidden', 'true')
          }
        }
      }
    }

    const run = () => {
      hideServicePropertyTypeCard()
      window.requestAnimationFrame(hideServicePropertyTypeCard)
    }

    run()
    const t0 = window.setTimeout(run, 0)
    const t1 = window.setTimeout(run, 250)
    const t2 = window.setTimeout(run, 1000)

    const observer = new MutationObserver(hideServicePropertyTypeCard)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      observer.disconnect()
    }
  }, [])

  return null
}
