'use client'

import { useEffect } from 'react'

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

  // Some existing logos render the brand as separate React nodes, e.g.
  // "Pro" followed by a styled "house" span. Replace only the Pro node so
  // the existing styling of "house" is preserved.
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

export default function RoyalhouseBrandFix() {
  useEffect(() => {
    document.title = replaceBrand(document.title)

    const update = () => updateTextNodes(document.body)
    update()

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue || ''
            if (text.includes('Prohouse') || text.includes('ProHouse') || text.includes('PROHOUSE') || text.trim() === 'Pro') {
              node.nodeValue = replaceBrand(text)
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            updateTextNodes(node)
          }
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
