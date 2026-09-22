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
            if (text.includes('Prohouse') || text.includes('ProHouse') || text.includes('PROHOUSE')) {
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
