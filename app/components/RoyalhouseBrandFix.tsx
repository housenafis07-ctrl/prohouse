'use client'

import { useLayoutEffect } from 'react'

const replaceBrand = (value: string) =>
  value.replace(/Prohouse/g, 'Royalhouse').replace(/ProHouse/g, 'RoyalHouse').replace(/PROHOUSE/g, 'ROYALHOUSE')

const translatePartnerLabel = (value: string, ru: boolean) => {
  if (ru) return value.replace(/Hamkorlar uchun/g, 'Для партнёров')
  return value.replace(/Для партнёров/g, 'Hamkorlar uchun')
}

function updateTextNodes(root: Node, ru: boolean) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current: Node | null = walker.nextNode()

  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }

  for (const node of nodes) {
    const parent = node.parentElement
    if (!parent) continue
    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) continue

    const value = node.nodeValue ?? ''
    const branded = replaceBrand(value)
    const translated = translatePartnerLabel(branded, ru)
    if (translated !== value) node.nodeValue = translated
  }
}

function applyRoyalhouseHeader() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('header a[href="/"]'))

  for (const link of links) {
    const text = link.textContent?.replace(/\s+/g, '').toLowerCase() ?? ''
    if (!text.includes('prohouse') && !text.includes('royalhouse')) continue

    link.className = 'flex shrink-0 items-center gap-2 text-2xl font-black leading-none'
    link.setAttribute('aria-label', 'Royalhouse')
    link.innerHTML = `
      <img src="/royalhouse-icon.svg" alt="Royalhouse" width="40" height="40" class="h-10 w-10 shrink-0 rounded-xl object-cover" />
      <span class="tracking-[-0.04em] text-slate-900">Royal<span class="text-emerald-500">house</span></span>
    `
  }
}

export default function RoyalhouseBrandFix() {
  useLayoutEffect(() => {
    let applying = false

    const getRu = () => window.localStorage.getItem('prohouse-lang') === 'ru'

    const apply = () => {
      if (applying) return
      applying = true
      try {
        const ru = getRu()
        document.title = replaceBrand(translatePartnerLabel(document.title, ru))
        updateTextNodes(document.body, ru)
        applyRoyalhouseHeader()
      } finally {
        applying = false
      }
    }

    apply()
    const frame = requestAnimationFrame(apply)
    const delayed = window.setTimeout(apply, 100)
    const delayed2 = window.setTimeout(apply, 500)

    const onStorage = () => apply()
    const onLanguageChange = () => apply()
    window.addEventListener('storage', onStorage)
    window.addEventListener('prohouse-language-change', onLanguageChange)

    const observer = new MutationObserver((mutations) => {
      if (applying) return

      applying = true
      try {
        const ru = getRu()
        for (const mutation of mutations) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.TEXT_NODE) {
              const value = node.nodeValue ?? ''
              const translated = translatePartnerLabel(replaceBrand(value), ru)
              if (translated !== value) node.nodeValue = translated
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              updateTextNodes(node, ru)
            }
          }
        }
        document.title = replaceBrand(translatePartnerLabel(document.title, ru))
      } finally {
        applying = false
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(delayed)
      window.clearTimeout(delayed2)
      observer.disconnect()
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('prohouse-language-change', onLanguageChange)
    }
  }, [])

  return null
}
