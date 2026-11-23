'use client'

import { useEffect } from 'react'

/**
 * Makes the four mobile home search tabs immediately apply their listing
 * filters instead of only changing local component state.
 */
export default function RoyalhouseMobileHomeTabFix() {
  useEffect(() => {
    let cleanup: (() => void) | null = null
    let timer: number | undefined

    const bind = () => {
      const root = document.querySelector('[data-royalhouse-mobile-search]') as HTMLElement | null
      if (!root) {
        timer = window.setTimeout(bind, 200)
        return
      }

      const buttons = Array.from(root.querySelectorAll('button')).slice(0, 4)
      if (buttons.length < 4) {
        timer = window.setTimeout(bind, 200)
        return
      }

      const handlers = buttons.map((button) => {
        const handler = (event: Event) => {
          event.preventDefault()
          event.stopPropagation()
          const label = (button.textContent || '').trim().toLocaleLowerCase('uz-UZ')
          const params = new URLSearchParams()

          if (label.includes('ijara') || label.includes('арен')) {
            params.set('tab', 'rent')
          } else if (label.includes('kunlik') || label.includes('сут')) {
            params.set('tab', 'daily')
          } else if (label.includes('yangi') || label.includes('новост')) {
            params.set('tab', 'sale')
            params.set('type', 'new_building')
          } else {
            params.set('tab', 'sale')
          }

          window.location.assign(`/listings?${params.toString()}`)
        }
        button.addEventListener('click', handler, true)
        return () => button.removeEventListener('click', handler, true)
      })

      cleanup = () => handlers.forEach((remove) => remove())
    }

    bind()
    return () => {
      if (timer) window.clearTimeout(timer)
      cleanup?.()
    }
  }, [])

  return null
}
