'use client'

import { useEffect } from 'react'

type Lang = 'uz' | 'ru'

const getLang = (): Lang => window.localStorage.getItem('prohouse-lang') === 'ru' ? 'ru' : 'uz'

const labelFor = (lang: Lang) => lang === 'ru' ? 'Для партнёров' : 'Hamkorlar uchun'

export default function RoyalhousePartnersLinkFix() {
  useEffect(() => {
    const fix = () => {
      const label = labelFor(getLang())
      const nodes = Array.from(document.querySelectorAll('span,div,a,button'))
      nodes.forEach((node) => {
        if (node.getAttribute('data-royalhouse-partners-link') === '1') {
          node.textContent = label
          return
        }

        const text = node.textContent?.trim()
        if (text !== 'Hamkorlar uchun' && text !== 'Партнёрам' && text !== 'Для партнёров') return
        if (node.children.length > 0) return

        const link = document.createElement('a')
        link.href = '/partners'
        link.textContent = label
        link.className = node.className
        link.setAttribute('data-royalhouse-partners-link', '1')
        node.replaceWith(link)
      })
    }

    fix()

    const onLanguageChange = () => fix()
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'prohouse-lang') fix()
    }

    window.addEventListener('prohouse-language-change', onLanguageChange)
    window.addEventListener('storage', onStorage)

    const observer = new MutationObserver(fix)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('prohouse-language-change', onLanguageChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return null
}
