'use client'

import { useEffect } from 'react'

function findLegacySearch() {
  const inputs = Array.from(document.querySelectorAll('input'))
  const legacyInput = inputs
    .filter((input) => {
      const placeholder = input.getAttribute('placeholder') || ''
      const aria = input.getAttribute('aria-label') || ''
      return /Toshkentda 3 xonali|3-komnatnaya|3-комнатная/i.test(placeholder) && !/Aqlli qidiruv|Умный поиск/i.test(aria)
    })
    .at(-1) as HTMLInputElement | undefined

  if (!legacyInput) return null

  let node: HTMLElement | null = legacyInput
  while (node && node !== document.body) {
    const text = (node.textContent || '').replace(/\s+/g, ' ')
    const hasDistrict = /Barcha tuman va shaharlar|Все районы и города/i.test(text)
    const hasType = /Barcha turlar|Все типы/i.test(text)
    const hasPrice = /Istalgan narx|Любая цена/i.test(text)
    const hasSearch = /Qidirish|Найти/i.test(text)

    if (hasDistrict && hasType && hasPrice && hasSearch) return node
    node = node.parentElement
  }

  return legacyInput.parentElement?.parentElement?.parentElement || null
}

export default function RoyalhousePwaHomeSearchFix() {
  useEffect(() => {
    let cancelled = false
    let observer: MutationObserver | null = null
    let timer: number | undefined

    const apply = () => {
      if (cancelled) return

      const host = document.querySelector('[data-royalhouse-mobile-search]') as HTMLElement | null
      if (!host) {
        timer = window.setTimeout(apply, 100)
        return
      }

      host.style.display = 'block'
      host.style.position = 'relative'
      host.style.zIndex = '40'

      const legacy = findLegacySearch()
      if (legacy && legacy !== host) {
        legacy.setAttribute('data-royalhouse-legacy-search', 'true')
        legacy.style.display = 'none'

        const parent = legacy.parentElement
        if (parent && host.parentElement !== parent) {
          parent.insertBefore(host, legacy)
        }
      }
    }

    apply()
    observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })

    timer = window.setTimeout(() => {
      observer?.disconnect()
      observer = null
    }, 5000)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      observer?.disconnect()
      document.querySelectorAll('[data-royalhouse-legacy-search="true"]').forEach((element) => {
        ;(element as HTMLElement).style.removeProperty('display')
        element.removeAttribute('data-royalhouse-legacy-search')
      })
    }
  }, [])

  return (
    <style dangerouslySetInnerHTML={{
      __html: `
        [data-royalhouse-mobile-search] {
          display: block !important;
          position: relative !important;
          z-index: 40 !important;
        }
        [data-royalhouse-legacy-search="true"] {
          display: none !important;
        }
      `,
    }} />
  )
}
