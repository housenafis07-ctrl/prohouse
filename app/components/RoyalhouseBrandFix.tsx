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
    if (node.nodeValue?.includes('Prohouse') || node.nodeValue?.includes('ProHouse') || node.nodeValue?.includes('PROHOUSE')) {
      node.nodeValue = replaceBrand(node.nodeValue)
    }
  }

  for (const node of nodes) {
    const value = node.nodeValue?.trim()
    if (value !== 'Pro' && value !== 'ProHouse') continue

    const next = node.nextSibling
    if (value === 'ProHouse') {
      node.nodeValue = node.nodeValue?.replace('ProHouse', 'RoyalHouse') ?? node.nodeValue
      continue
    }

    if (next?.nodeType === Node.ELEMENT_NODE) {
      const nextElement = next as Element
      if (nextElement.textContent?.trim() === 'house') {
        node.nodeValue = node.nodeValue?.replace('Pro', 'Royal') ?? node.nodeValue
      }
    } else if (next?.nodeType === Node.TEXT_NODE && next.nodeValue?.trim() === 'house') {
      node.nodeValue = node.nodeValue?.replace('Pro', 'Royal') ?? node.nodeValue
    }
  }
}

function applyRoyalhouseHeader() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('header a[href="/"]'))

  for (const link of links) {
    const text = link.textContent?.replace(/\s+/g, '').toLowerCase() ?? ''
    const alreadyRoyalhouse = Boolean(link.querySelector('img[alt="Royalhouse"]')) && text.includes('royalhouse')

    if (alreadyRoyalhouse) continue
    if (!text.includes('royalhouse') && !text.includes('prohouse')) continue

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
    const update = () => {
      document.title = replaceBrand(document.title)
      updateTextNodes(document.body)
      applyRoyalhouseHeader()
    }

    update()
    const frame = requestAnimationFrame(update)
    const delayed = window.setTimeout(update, 0)

    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false

      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue

        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue || ''
            if (text.includes('Prohouse') || text.includes('ProHouse') || text.includes('PROHOUSE') || text.trim() === 'Pro') {
              node.nodeValue = replaceBrand(text)
              shouldUpdate = true
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            updateTextNodes(node)
            shouldUpdate = true
          }
        }
      }

      if (shouldUpdate) applyRoyalhouseHeader()
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(delayed)
      observer.disconnect()
    }
  }, [])

  return null
}
