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

  // Some existing logos render "Pro" and "house" as separate React nodes,
  // so the full brand string never exists in a single text node.
  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll('*'))] : Array.from(document.querySelectorAll('*'))
  for (const element of elements) {
    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(element.tagName)) continue
    if (element.textContent !== 'Prohouse' && element.textContent !== 'ProHouse' && element.textContent !== 'PROHOUSE') continue

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let textNode: Node | null = walker.nextNode()
    while (textNode) {
      if (textNode.nodeValue?.includes('Pro')) {
        textNode.nodeValue = textNode.nodeValue.replace('Pro', 'Royal')
        break
      }
      textNode = walker.nextNode()
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
