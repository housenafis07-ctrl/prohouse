'use client'

import { useLayoutEffect } from 'react'

const replaceBrand = (value: string) =>
  value.replace(/Prohouse/g, 'Royalhouse').replace(/ProHouse/g, 'RoyalHouse').replace(/PROHOUSE/g, 'ROYALHOUSE')

const containsLegacyBrand = (value: string) => /Prohouse|ProHouse|PROHOUSE/.test(value)

function updateTextNodes(root: Node) {
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
    if (containsLegacyBrand(value)) node.nodeValue = replaceBrand(value)
  }
}

function updateBrandAttributes(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[title],[aria-label],[alt],[data-brand],[content]').forEach((element) => {
    for (const attribute of ['title', 'aria-label', 'alt', 'data-brand', 'content']) {
      const value = element.getAttribute(attribute)
      if (value && containsLegacyBrand(value)) element.setAttribute(attribute, replaceBrand(value))
    }
  })
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

function applyRoyalhouseBrand() {
  document.title = replaceBrand(document.title)
  updateTextNodes(document.body)
  updateBrandAttributes(document)
  applyRoyalhouseHeader()
}

export default function RoyalhouseBrandFix() {
  useLayoutEffect(() => {
    let applying = false

    const apply = () => {
      if (applying) return
      applying = true
      try {
        applyRoyalhouseBrand()
      } finally {
        applying = false
      }
    }

    apply()
    const frame = requestAnimationFrame(apply)
    const delayed = window.setTimeout(apply, 100)

    const observer = new MutationObserver((mutations) => {
      if (applying) return

      applying = true
      try {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') {
            const node = mutation.target as Text
            const value = node.nodeValue ?? ''
            if (containsLegacyBrand(value)) node.nodeValue = replaceBrand(value)
            continue
          }

          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.TEXT_NODE) {
              const value = node.nodeValue ?? ''
              if (containsLegacyBrand(value)) node.nodeValue = replaceBrand(value)
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              updateTextNodes(node)
              updateBrandAttributes(node as Element)
            }
          }
        }

        applyRoyalhouseBrand()
      } finally {
        applying = false
      }
    })

    // React hydration may replace an existing text node without inserting a new node.
    // Keep this isolated to branding so the language and search logic remain untouched.
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(delayed)
      observer.disconnect()
    }
  }, [])

  return null
}
