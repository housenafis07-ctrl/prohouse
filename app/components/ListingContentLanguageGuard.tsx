'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function markElement(element: Element | null) {
  if (element instanceof HTMLElement) element.setAttribute('data-no-global-i18n', 'true')
}

function protectListingUserContent() {
  if (!/^\/listings\/[^/]+\/?$/.test(window.location.pathname)) return

  document.querySelectorAll('h1').forEach(markElement)
  document.querySelectorAll('p.whitespace-pre-wrap').forEach(markElement)
  document.querySelectorAll('p.mt-3.text-sm.text-slate-500').forEach(markElement)

  // Seller name is user/profile data. Keep the surrounding seller card
  // translatable, but protect only the actual name.
  document.querySelectorAll('p.font-black').forEach((element) => {
    const card = element.closest('.bg-emerald-50')
    if (card) markElement(element)
  })

  // The breadcrumb contains a static UI label plus the user-entered listing
  // title in the same element. Wrap only the trailing title text node.
  const breadcrumb = document.querySelector('div.mb-5.text-sm.text-slate-500')
  if (breadcrumb && !breadcrumb.querySelector('[data-no-global-i18n]')) {
    const nodes = Array.from(breadcrumb.childNodes)
    const separatorIndex = nodes.findIndex((node) => node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'SPAN' && (node.textContent || '').trim() === '›')
    if (separatorIndex >= 0) {
      for (const node of nodes.slice(separatorIndex + 1)) {
        if (node.nodeType !== Node.TEXT_NODE || !(node.nodeValue || '').trim()) continue
        const span = document.createElement('span')
        span.setAttribute('data-no-global-i18n', 'true')
        span.textContent = node.nodeValue
        node.parentNode?.replaceChild(span, node)
        break
      }
    }
  }
}

export default function ListingContentLanguageGuard() {
  const pathname = usePathname()

  useEffect(() => {
    protectListingUserContent()
    window.dispatchEvent(new CustomEvent('prohouse-language-change'))
  }, [pathname])

  return null
}
