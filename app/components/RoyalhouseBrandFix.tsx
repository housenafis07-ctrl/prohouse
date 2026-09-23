'use client'

import { useLayoutEffect } from 'react'

const LEGACY_BRAND_RE = /Prohouse|ProHouse|PROHOUSE|prohouse/g

const replaceBrand = (value: string) =>
  value
    .replace(/Prohouse/g, 'Royalhouse')
    .replace(/ProHouse/g, 'RoyalHouse')
    .replace(/PROHOUSE/g, 'ROYALHOUSE')
    .replace(/prohouse/g, 'royalhouse')

function migrateLegacyLanguageState() {
  try {
    const legacy = window.localStorage.getItem('prohouse-lang')
    const current = window.localStorage.getItem('royalhouse-lang')
    if (!current && (legacy === 'uz' || legacy === 'ru')) {
      window.localStorage.setItem('royalhouse-lang', legacy)
    }
  } catch {
    // Ignore storage access errors in privacy-restricted browsers.
  }
}

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
    if (['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) continue

    const value = node.nodeValue ?? ''
    if (LEGACY_BRAND_RE.test(value)) {
      LEGACY_BRAND_RE.lastIndex = 0
      node.nodeValue = replaceBrand(value)
    }
    LEGACY_BRAND_RE.lastIndex = 0
  }
}

function updateBrandAttributes(root: ParentNode = document) {
  const elements = Array.from(root.querySelectorAll<HTMLElement>('*'))
  for (const element of elements) {
    for (const attribute of ['aria-label', 'alt', 'title', 'placeholder', 'value', 'content']) {
      const value = element.getAttribute(attribute)
      if (!value || !LEGACY_BRAND_RE.test(value)) {
        LEGACY_BRAND_RE.lastIndex = 0
        continue
      }
      LEGACY_BRAND_RE.lastIndex = 0
      element.setAttribute(attribute, replaceBrand(value))
    }
  }
}

function updateHeadBranding() {
  document.title = replaceBrand(document.title)
  document.querySelectorAll<HTMLMetaElement>('meta[content]').forEach((meta) => {
    const value = meta.getAttribute('content')
    if (!value) return
    if (LEGACY_BRAND_RE.test(value)) {
      LEGACY_BRAND_RE.lastIndex = 0
      meta.setAttribute('content', replaceBrand(value))
    } else {
      LEGACY_BRAND_RE.lastIndex = 0
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

function applyBrandFix() {
  migrateLegacyLanguageState()
  updateHeadBranding()
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
        applyBrandFix()
      } finally {
        applying = false
      }
    }

    apply()
    const frame = requestAnimationFrame(apply)
    const delayed = window.setTimeout(apply, 100)

    const onLegacyLanguageChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (detail !== 'uz' && detail !== 'ru') return
      try {
        window.localStorage.setItem('royalhouse-lang', detail)
        window.dispatchEvent(new CustomEvent('royalhouse-language-change', { detail }))
      } catch {
        // Ignore storage access errors.
      }
    }

    window.addEventListener('prohouse-language-change', onLegacyLanguageChange)

    const observer = new MutationObserver((mutations) => {
      if (applying) return

      applying = true
      try {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') {
            const node = mutation.target as Text
            const value = node.nodeValue ?? ''
            if (LEGACY_BRAND_RE.test(value)) {
              LEGACY_BRAND_RE.lastIndex = 0
              node.nodeValue = replaceBrand(value)
            } else {
              LEGACY_BRAND_RE.lastIndex = 0
            }
            continue
          }

          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.TEXT_NODE) {
              const value = node.nodeValue ?? ''
              if (LEGACY_BRAND_RE.test(value)) {
                LEGACY_BRAND_RE.lastIndex = 0
                node.nodeValue = replaceBrand(value)
              } else {
                LEGACY_BRAND_RE.lastIndex = 0
              }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              updateTextNodes(node)
              updateBrandAttributes(node as Element)
            }
          }
        }
        updateHeadBranding()
      } finally {
        applying = false
      }
    })

    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(delayed)
      window.removeEventListener('prohouse-language-change', onLegacyLanguageChange)
      observer.disconnect()
    }
  }, [])

  return null
}
