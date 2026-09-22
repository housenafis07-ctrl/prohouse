'use client'

import { useLayoutEffect } from 'react'

const replaceBrand = (value: string) =>
  value.replace(/Prohouse/g, 'Royalhouse').replace(/ProHouse/g, 'RoyalHouse').replace(/PROHOUSE/g, 'ROYALHOUSE')

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
    if (value.includes('Prohouse') || value.includes('ProHouse') || value.includes('PROHOUSE')) {
      node.nodeValue = replaceBrand(value)
    }
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
    // One-shot correction only. Do not observe DOM mutations: changing the
    // header itself would otherwise trigger the observer recursively and freeze the page.
    const apply = () => {
      document.title = replaceBrand(document.title)
      updateTextNodes(document.body)
      applyRoyalhouseHeader()
    }

    apply()
    const frame = requestAnimationFrame(apply)
    const delayed = window.setTimeout(apply, 100)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(delayed)
    }
  }, [])

  return null
}
