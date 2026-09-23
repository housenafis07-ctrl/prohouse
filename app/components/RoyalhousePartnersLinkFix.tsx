'use client'

import { useEffect } from 'react'

export default function RoyalhousePartnersLinkFix() {
  useEffect(() => {
    const fix = () => {
      const nodes = Array.from(document.querySelectorAll('span,div,a,button'))
      nodes.forEach((node) => {
        if (node.getAttribute('data-royalhouse-partners-link') === '1') return
        const text = node.textContent?.trim()
        if (text !== 'Hamkorlar uchun' && text !== 'Партнёрам' && text !== 'Для партнёров') return
        if (node.children.length > 0) return
        const link = document.createElement('a')
        link.href = '/partners'
        link.textContent = text
        link.className = node.className
        link.setAttribute('data-royalhouse-partners-link', '1')
        node.replaceWith(link)
      })
    }

    fix()
    const observer = new MutationObserver(fix)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  return null
}
