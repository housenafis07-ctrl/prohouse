'use client'

import { useLayoutEffect } from 'react'

const LEGACY_BRAND_RE = /Prohouse|ProHouse|PROHOUSE|prohouse/g

const replaceBrand = (value: string) =>
  value
    .replace(/Prohouse/g, 'Royalhouse')
    .replace(/ProHouse/g, 'RoyalHouse')
    .replace(/PROHOUSE/g, 'ROYALHOUSE')
    .replace(/prohouse/g, 'royalhouse')

function replaceTextNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let node = walker.nextNode()

  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }

  for (const text of nodes) {
    const parent = text.parentElement
    if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) continue

    const value = text.nodeValue ?? ''
    if (!LEGACY_BRAND_RE.test(value)) {
      LEGACY_BRAND_RE.lastIndex = 0
      continue
    }

    LEGACY_BRAND_RE.lastIndex = 0
    text.nodeValue = replaceBrand(value)
  }
}

function replaceAttributes() {
  document.querySelectorAll<HTMLElement>('*').forEach((element) => {
    for (const attribute of ['aria-label', 'alt', 'title', 'placeholder', 'value', 'content']) {
      const value = element.getAttribute(attribute)
      if (!value || !LEGACY_BRAND_RE.test(value)) {
        LEGACY_BRAND_RE.lastIndex = 0
        continue
      }

      LEGACY_BRAND_RE.lastIndex = 0
      element.setAttribute(attribute, replaceBrand(value))
    }
  })
}

function replaceHead() {
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

function installBrandCss() {
  if (document.getElementById('royalhouse-brand-css')) return

  const style = document.createElement('style')
  style.id = 'royalhouse-brand-css'
  style.textContent = `
    /* The homepage header is still rendered from a legacy split text node in the current branch.
       Hide only that visual text and render the canonical Royalhouse brand. */
    header a[href="/"] {
      font-size: 0 !important;
    }
    header a[href="/"] > span {
      font-size: 1rem !important;
    }
    header a[href="/"]::after {
      content: 'Royalhouse';
      font-size: 1.5rem;
      line-height: 1;
      font-weight: 900;
    }
    footer b {
      font-size: 0 !important;
    }
    footer b::after {
      content: 'Royalhouse';
      font-size: 1.25rem;
      line-height: 1;
      font-weight: 900;
    }
  `
  document.head.appendChild(style)
}

function applyBrandFix() {
  try {
    const legacyLang = window.localStorage.getItem('prohouse-lang')
    const currentLang = window.localStorage.getItem('royalhouse-lang')
    if (!currentLang && (legacyLang === 'uz' || legacyLang === 'ru')) {
      window.localStorage.setItem('royalhouse-lang', legacyLang)
    }
  } catch {
    // Ignore restricted storage access.
  }

  installBrandCss()
  replaceHead()
  replaceTextNodes(document.body)
  replaceAttributes()
}

export default function RoyalhouseBrandFix() {
  useLayoutEffect(() => {
    const body = document.body
    const previousVisibility = body.style.visibility

    body.style.visibility = 'hidden'
    try {
      applyBrandFix()
    } finally {
      body.style.visibility = previousVisibility
    }

    const frame = window.requestAnimationFrame(applyBrandFix)
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return null
}
