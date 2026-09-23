'use client'

import { useLayoutEffect } from 'react'

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
    // Ignore storage access errors.
  }
}

function updateTextNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null = walker.nextNode()

  while (node) {
    const text = node as Text
    const parent = text.parentElement
    if (parent && !['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) {
      const value = text.nodeValue ?? ''
      if (/Prohouse|ProHouse|PROHOUSE|prohouse/.test(value)) {
        text.nodeValue = replaceBrand(value)
      }
    }
    node = walker.nextNode()
  }
}

function updateHeadBranding() {
  document.title = replaceBrand(document.title)
  document.querySelectorAll<HTMLMetaElement>('meta[content]').forEach((meta) => {
    const value = meta.getAttribute('content')
    if (value) meta.setAttribute('content', replaceBrand(value))
  })
}

function applyRoyalhouseHeader() {
  document.querySelectorAll<HTMLAnchorElement>('header a[href="/"]').forEach((link) => {
    const text = link.textContent?.replace(/\s+/g, '').toLowerCase() ?? ''
    if (!text.includes('prohouse') && !text.includes('royalhouse')) return

    link.className = 'flex shrink-0 items-center gap-2 text-2xl font-black leading-none'
    link.setAttribute('aria-label', 'Royalhouse')
    link.innerHTML = `
      <img src="/royalhouse-icon.svg" alt="Royalhouse" width="40" height="40" class="h-10 w-10 shrink-0 rounded-xl object-cover" />
      <span class="tracking-[-0.04em] text-slate-900">Royal<span class="text-emerald-500">house</span></span>
    `
  })
}

function applyBrandFix() {
  migrateLegacyLanguageState()
  updateHeadBranding()
  updateTextNodes(document.body)
  applyRoyalhouseHeader()
}

export default function RoyalhouseBrandFix() {
  useLayoutEffect(() => {
    // Intentionally one-shot. A global MutationObserver caused a feedback loop
    // with Next.js/React hydration and could freeze the browser tab.
    applyBrandFix()

    const frame = requestAnimationFrame(applyBrandFix)
    const delayed = window.setTimeout(applyBrandFix, 150)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(delayed)
    }
  }, [])

  return null
}
